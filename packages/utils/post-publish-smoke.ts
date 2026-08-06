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

export function runPostPublishSmoke(packages: readonly PublishedPackage[]): void {
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

    let installed = false
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      try {
        execFileSync('npm', ['install', '--silent', '--no-audit', '--no-fund', '--prefer-online'], {
          cwd: workdir,
          stdio: 'inherit',
        })
        installed = true
        break
      } catch {
        if (attempt === 5) throw new Error('published packages did not become installable from npm')
        console.log(`Registry install attempt ${String(attempt)} failed; retrying…`)
        pause(6_000)
      }
    }
    if (!installed) throw new Error('published packages did not install')

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
