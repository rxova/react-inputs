/**
 * Verifies the registry, rather than the workspace, after Changesets publishes.
 *
 * The pre-release tarball smoke test is the stronger contract check, but it
 * cannot catch registry propagation or an unexpectedly missing publication.
 * This installs the exact versions reported by changesets/action into a fresh
 * npm project, confirms those versions arrived, and imports every React package
 * through both ESM and CommonJS.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

export interface PublishedPackage {
  readonly name: string
  readonly version: string
}

export function parsePublishedPackages(value: string): PublishedPackage[] {
  const parsed: unknown = JSON.parse(value)
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('changesets/action reported no published packages')
  }

  return parsed.map((candidate: unknown) => {
    if (
      typeof candidate !== 'object' ||
      candidate === null ||
      !('name' in candidate) ||
      typeof candidate.name !== 'string' ||
      !candidate.name.startsWith('@rxova/') ||
      !('version' in candidate) ||
      typeof candidate.version !== 'string' ||
      candidate.version.length === 0
    ) {
      throw new Error('changesets/action returned an invalid published package')
    }
    return { name: candidate.name, version: candidate.version }
  })
}

export const importableReactPackages = (packages: readonly PublishedPackage[]) =>
  packages.filter(({ name }) => name.startsWith('@rxova/react-'))

const pause = (milliseconds: number): void => {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds)
}

const describePackages = (packages: readonly PublishedPackage[]) =>
  packages.map(({ name, version }) => `${name}@${version}`).join(', ')

/** What npm printed on stderr when a child process failed, else the error's own message. */
export function npmFailureReason(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'stderr' in error) {
    const stderr = String(error.stderr).trim()
    if (stderr.length > 0) return stderr
  }
  return error instanceof Error ? error.message : String(error)
}

export interface RegistryWaitOptions {
  /** Whether the registry already serves this exact version. */
  readonly isPublished: (item: PublishedPackage) => boolean
  readonly sleep?: (milliseconds: number) => void
  readonly now?: () => number
  readonly deadlineMs?: number
  readonly log?: (message: string) => void
}

/**
 * Blocks until npm serves every published version. The registry can take
 * minutes to list a version after `npm publish` returns (the 2026-09-15 release
 * took almost three), so polling with backoff finishes as soon as npm catches
 * up and only fails once the deadline says it never did.
 */
export function waitForRegistry(
  packages: readonly PublishedPackage[],
  {
    isPublished,
    sleep = pause,
    now = Date.now,
    deadlineMs = 10 * 60_000,
    log = console.log,
  }: RegistryWaitOptions,
): void {
  const start = now()
  let pending = [...packages]
  let delay = 5_000
  for (;;) {
    pending = pending.filter((item) => !isPublished(item))
    if (pending.length === 0) return
    const elapsed = now() - start
    if (elapsed >= deadlineMs) {
      throw new Error(
        `npm still does not serve ${describePackages(pending)} after ${String(deadlineMs / 1000)}s`,
      )
    }
    const wait = Math.min(delay, deadlineMs - elapsed)
    log(`Waiting ${String(wait / 1000)}s for npm to serve ${describePackages(pending)}…`)
    sleep(wait)
    delay = Math.min(delay * 2, 30_000)
  }
}

/** Asks the registry, bypassing the local cache, whether it lists this exact version yet. */
const npmServes = ({ name, version }: PublishedPackage): boolean => {
  try {
    const output = execFileSync(
      'npm',
      ['view', `${name}@${version}`, 'version', '--prefer-online'],
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
    return output.trim() === version
  } catch {
    // A first-ever publish is a 404 until the registry catches up.
    return false
  }
}

export interface InstallRetryOptions {
  readonly attempts?: number
  readonly sleep?: (milliseconds: number) => void
  readonly log?: (message: string) => void
}

/**
 * Runs the install, retrying briefly: the registry can list a version a moment
 * before a fresh install resolves it. Every failure prints npm's own error, so
 * a real defect (a bad dependency range, a missing file) is not mistaken for lag.
 */
export function installWithRetries(
  install: () => void,
  { attempts = 3, sleep = pause, log = console.log }: InstallRetryOptions = {},
): void {
  for (let attempt = 1; ; attempt += 1) {
    try {
      install()
      return
    } catch (error) {
      const reason = npmFailureReason(error)
      if (attempt >= attempts) {
        throw new Error(`published packages did not install from npm:\n${reason}`, {
          cause: error,
        })
      }
      log(`Registry install attempt ${String(attempt)} failed; retrying…\n${reason}`)
      sleep(10_000)
    }
  }
}

export function runPostPublishSmoke(packages: readonly PublishedPackage[]): void {
  waitForRegistry(packages, { isPublished: npmServes })
  const workdir = mkdtempSync(join(tmpdir(), 'rxova-registry-smoke-'))
  try {
    writeFileSync(
      join(workdir, 'package.json'),
      `${JSON.stringify(
        {
          name: 'rxova-registry-smoke',
          version: '1.0.0',
          private: true,
          type: 'module',
          dependencies: {
            ...Object.fromEntries(packages.map(({ name, version }) => [name, version])),
            react: '^19.0.0',
            'react-dom': '^19.0.0',
          },
        },
        null,
        2,
      )}\n`,
    )

    installWithRetries(() => {
      // stderr is captured, not inherited, so a failure can report npm's error.
      execFileSync('npm', ['install', '--no-audit', '--no-fund', '--prefer-online'], {
        cwd: workdir,
        stdio: ['ignore', 'inherit', 'pipe'],
      })
    })

    const verifier = `
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const require = createRequire(import.meta.url)
const published = ${JSON.stringify(packages)}
const importable = ${JSON.stringify(importableReactPackages(packages))}

for (const item of published) {
  const manifestPath = resolve('node_modules', ...item.name.split('/'), 'package.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  if (manifest.version !== item.version) {
    throw new Error(item.name + ': expected ' + item.version + ', installed ' + manifest.version)
  }
  console.log('  ✔ ' + item.name + '@' + item.version + ' installed')
}

for (const item of importable) {
  const esm = await import(item.name)
  const cjs = require(item.name)
  if (Object.keys(esm).length === 0 || Object.keys(cjs).length === 0) {
    throw new Error(item.name + ' exposes no exports')
  }
  console.log('  ✔ ' + item.name + ' resolves through ESM and CommonJS')
}
`
    writeFileSync(join(workdir, 'verify.mjs'), verifier)
    execFileSync('node', ['verify.mjs'], { cwd: workdir, stdio: 'inherit' })
  } finally {
    rmSync(workdir, { recursive: true, force: true })
  }
}

const isEntrypoint =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href

if (isEntrypoint) {
  try {
    const packages = parsePublishedPackages(process.env.PUBLISHED_PACKAGES ?? '')
    console.log(`Checking ${String(packages.length)} freshly published package(s) from npm…`)
    runPostPublishSmoke(packages)
    console.log('✔ post-publish registry smoke test passed')
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  }
}
