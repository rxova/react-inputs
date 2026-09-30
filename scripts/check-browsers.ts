/**
 * Keeps the installed browser list and bounded local concurrency in step with
 * every component package's Playwright config.
 *
 * Every config is a `basePlaywrightConfig({ … })` call from
 * @rxova/repo-config/playwright, which runs each spec in every entry of
 * `browsers` (Chromium alone when the key is absent) on one worker unless
 * `workers` says otherwise. So the check reads those two keys: the browsers
 * must all be installed by `e2e:install`, and `workers` must stay 1.
 *
 * The checks are pure over a supplied repository root so tests can exercise
 * broken fixtures without mutating this checkout. The CLI adapter is guarded at
 * the bottom, matching the other scripts in this directory.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

import { readManifest } from './manifest'

export interface BrowserCheckResult {
  readonly configs: number
  readonly projects: readonly string[]
  readonly failures: readonly string[]
}

/** The preset's default when a config names no `browsers`. */
const DEFAULT_BROWSERS = ['chromium']

/** The `browsers: [...]` a config passes to basePlaywrightConfig, else the preset default. */
export function browsersOf(config: string): string[] {
  const list = /\bbrowsers:\s*\[([^\]]*)\]/.exec(config)?.[1]
  if (list === undefined) return DEFAULT_BROWSERS
  return [...list.matchAll(/['"]([a-z]+)['"]/g)]
    .map((match) => match[1])
    .filter((name): name is string => name !== undefined)
}

export function checkBrowserConfigs(repoRoot: string = process.cwd()): BrowserCheckResult {
  const failures: string[] = []
  const rootPkg = readManifest(resolve(repoRoot, 'package.json'))
  const install = rootPkg.scripts?.['e2e:install']
  const e2e = rootPkg.scripts?.e2e
  const serial = rootPkg.scripts?.['e2e:serial']

  if (!install) failures.push('root package.json has no `e2e:install` script')
  if (!e2e?.includes('--concurrency=3')) {
    failures.push('root `e2e` must cap Turbo package concurrency at 3')
  }
  if (!serial?.includes('--concurrency=1')) {
    failures.push('root `e2e:serial` must cap Turbo package concurrency at 1')
  }

  const configRoots = [
    { dir: resolve(repoRoot, 'packages'), include: () => true },
    { dir: resolve(repoRoot, 'apps'), include: (name: string) => name.startsWith('compat-') },
  ]
  const configs = configRoots.flatMap(({ dir, include }) =>
    existsSync(dir)
      ? readdirSync(dir, { withFileTypes: true })
          .filter((entry) => entry.isDirectory() && include(entry.name))
          .map((entry) => resolve(dir, entry.name, 'playwright.config.ts'))
          .filter(existsSync)
      : [],
  )

  if (configs.length === 0) failures.push('found no component or compatibility Playwright configs')

  const allProjects = new Set<string>()
  for (const configPath of configs) {
    const config = readFileSync(configPath, 'utf8')
    const relative = configPath.slice(repoRoot.length + 1)

    if (!/\bbasePlaywrightConfig\(/.test(config)) {
      failures.push(`${relative} is not built on basePlaywrightConfig`)
      continue
    }
    const projects = browsersOf(config)
    const workers = /\bworkers:\s*([^,\n}]+)/.exec(config)?.[1]?.trim()
    if (workers !== undefined && workers !== '1') {
      failures.push(`${relative} must leave \`workers\` at 1, found \`${workers}\``)
    }

    if (install) {
      const missing = projects.filter((browser) => !install.includes(browser))
      if (missing.length > 0) {
        failures.push(
          `${relative} launches [${projects.join(', ')}], but e2e:install omits ${missing.join(', ')}`,
        )
      }
    }
    projects.forEach((project) => allProjects.add(project))
  }

  return {
    configs: configs.length,
    projects: [...allProjects],
    failures,
  }
}

const isEntrypoint =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href

if (isEntrypoint) {
  const result = checkBrowserConfigs()
  if (result.failures.length > 0) {
    console.error(`E2E configuration check failed:\n- ${result.failures.join('\n- ')}`)
    process.exit(1)
  }
  console.log(
    `✔ bounded E2E workers and installed browsers agree across ${String(result.configs)} packages ` +
      `(${result.projects.join(', ')})`,
  )
}
