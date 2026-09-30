/**
 * The numbers the landing page claims, read from the files CI actually enforces.
 *
 * A marketing page that hardcodes "≤ 10 kB" is wrong the day someone raises a
 * budget, and nothing fails — the page just quietly lies. So nothing here is
 * typed by hand: the size budgets come from the same `.size-limit.json` files
 * `pnpm size` reads, the coverage floors from the same `vitest.config.ts` the
 * test run reads, the browser matrix from the Playwright configs and the axe
 * tags from the a11y specs.
 *
 * Every reader throws when it cannot find what it is looking for, rather than
 * returning a default. A restructured config should break the docs build loudly;
 * the failure mode this exists to prevent is a green build that checked nothing.
 *
 * `.mjs` and dependency-free to match scripts/component-packages.mjs: this runs inside an Astro
 * config/SSR load, alongside component-packages.mjs which it builds on.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

import { componentPackages } from '../../../../scripts/component-packages.mjs'

/** The meta package, which carries the whole-suite budget rather than a component's. */
const SUITE_DIR = 'react-inputs'

/**
 * The repo root, found by walking up for the workspace manifest.
 *
 * Deliberately NOT component-packages.mjs's `REPO_ROOT`, which derives from
 * `import.meta.url`. That is correct everywhere it is used today — astro.config,
 * CI scripts, plain Node — but this module is also imported by a page, and Astro
 * bundles page code into dist/.prerender/, where the rewritten `import.meta.url`
 * puts the "repo root" several directories inside the build output. The first
 * build failed on exactly that.
 *
 * Walking up from cwd has no such problem: `astro build` and `astro dev` both
 * run in apps/docs, vitest runs in apps/docs, and the marker is unambiguous.
 */
function findRepoRoot() {
  let dir = process.cwd()

  for (;;) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir
    const parent = dirname(dir)
    if (parent === dir) {
      throw new Error(`no pnpm-workspace.yaml above ${resolve(process.cwd())}`)
    }
    dir = parent
  }
}

export const repoRoot = findRepoRoot()

const read = (...segments) => readFileSync(join(repoRoot, ...segments), 'utf8')

/** The component registry, resolved against the root found above. */
const components = () => componentPackages(repoRoot)

/**
 * "3.25 kB" -> 3.25. size-limit accepts a unit suffix and a space, and the
 * configs in this repo are all kB; anything else is a change worth failing on
 * rather than silently rendering as a different magnitude.
 */
function parseLimit(limit, where) {
  const match = /^([\d.]+)\s*kB$/.exec(limit)
  if (!match) throw new Error(`${where}: expected a "<n> kB" limit, got ${JSON.stringify(limit)}`)
  return Number(match[1])
}

function sizeLimitEntries(dir) {
  const where = `packages/${dir}/.size-limit.json`
  const entries = JSON.parse(read('packages', dir, '.size-limit.json'))
  if (!Array.isArray(entries) || entries.length === 0) throw new Error(`${where}: no entries`)

  return entries.map((entry) => ({
    name: entry.name,
    // The `import` is the identity of a budget — a name is prose and gets
    // reworded, and an array index silently changes meaning on a reorder.
    import: entry.import,
    limitKb: parseLimit(entry.limit, `${where} (${entry.name})`),
  }))
}

/**
 * The whole-suite budget and the tree-shaken single-component budget, which are
 * the two numbers worth leading with: the ceiling if you take everything, and
 * the ceiling if you take one thing.
 *
 * size-limit's small-lib preset reports **Brotli**, not gzip. The unit is part
 * of the claim — saying gzip would overstate the win by roughly 15%.
 */
export function suiteBudget() {
  const entries = sizeLimitEntries(SUITE_DIR)
  const whole = entries.find((entry) => entry.import.split(',').length > 1)
  const single = entries.find((entry) => entry.import.split(',').length === 1)
  if (!whole || !single) {
    throw new Error(
      `packages/${SUITE_DIR}/.size-limit.json: expected both a multi-import (whole suite) and a single-import (tree-shaken) entry`,
    )
  }
  return { wholeKb: whole.limitKb, singleKb: single.limitKb, compression: 'Brotli' }
}

/**
 * Per-component budgets, one row per size-limit entry, discovered from the
 * component registry rather than listed here — a fourth input shows up on the
 * page by existing, exactly as it does in the sidebar and the CI matrices.
 */
export function packageBudgets() {
  return components().flatMap(({ dir, name, label }) =>
    sizeLimitEntries(dir).map((entry) => ({ dir, pkg: name, label, ...entry })),
  )
}

/**
 * The per-file coverage bar the shared preset applies when a package names no
 * axis of its own: `baseVitestConfig` from @rxova/repo-config/vitest measures
 * every file per file at 95 on each axis.
 */
const PRESET_THRESHOLD = 95

/**
 * The enforced coverage floor, as the weakest threshold across the suite.
 *
 * Read as text rather than by importing the config: these configs pull in
 * @vitejs/plugin-react and the Playwright browser provider at module scope,
 * which is a lot of machinery to boot inside a docs build just to read four
 * integers.
 *
 * Each config is a `baseVitestConfig({ … })` call. The preset holds every file
 * to {@link PRESET_THRESHOLD} per file on each axis, and a package overrides
 * only the axes it names in `thresholds: { … }`. So the reader starts from the
 * preset's bar and applies the overrides; a config that stops using the preset,
 * or turns thresholds off, is a restructure worth failing on.
 *
 * The floor is reported as a minimum across packages, not a single package's
 * number, because the page makes one claim about the whole suite. Today that is
 * 95 everywhere except branches, which is 90 on react-otp-input alone (its
 * defensive DOM/SSR guards can't be exercised) — so the honest claim is the
 * minimum, never the best case.
 */
export function coverageFloor() {
  const metrics = ['statements', 'branches', 'functions', 'lines']
  const floor = {}

  for (const { dir } of components()) {
    const where = `packages/${dir}/vitest.config.ts`
    const source = read('packages', dir, 'vitest.config.ts')
    if (!/\bbaseVitestConfig\(/.test(source)) {
      throw new Error(`${where}: no longer built on baseVitestConfig from @rxova/repo-config`)
    }
    if (/\bthresholds:\s*false\b/.test(source)) {
      throw new Error(`${where}: coverage thresholds are switched off`)
    }
    if (/\bcoverage:\s*false\b/.test(source)) {
      throw new Error(`${where}: coverage is switched off`)
    }

    const overrides = /\bthresholds:\s*\{([^}]*)\}/.exec(source)?.[1] ?? ''
    for (const metric of metrics) {
      const found = new RegExp(`\\b${metric}:\\s*(\\d+)`).exec(overrides)
      const value = found ? Number(found[1]) : PRESET_THRESHOLD
      floor[metric] = floor[metric] === undefined ? value : Math.min(floor[metric], value)
    }
  }

  return { ...floor, perFile: true }
}

/**
 * The browsers every component's E2E suite runs against: the `browsers` each
 * package passes to `basePlaywrightConfig`, which runs every spec in each.
 */
export function e2eBrowsers() {
  const perPackage = components().map(({ dir }) => {
    const where = `packages/${dir}/playwright.config.ts`
    const source = read('packages', dir, 'playwright.config.ts')
    if (!/\bbasePlaywrightConfig\(/.test(source)) {
      throw new Error(`${where}: no longer built on basePlaywrightConfig from @rxova/repo-config`)
    }
    const list = /\bbrowsers:\s*\[([^\]]*)\]/.exec(source)?.[1]
    const names = list ? [...list.matchAll(/['"]([^'"]+)['"]/g)].map((match) => match[1]) : []
    if (names.length === 0) throw new Error(`${where}: no \`browsers\` list found`)
    return names
  })

  // The intersection: a browser only counts if every component is tested on it.
  return perPackage.reduce((shared, names) => shared.filter((name) => names.includes(name)))
}

/**
 * The licence, as the single value every published package agrees on.
 *
 * Throws on disagreement rather than picking one: "MIT" on a landing page is a
 * promise about the whole suite, and a package that quietly differs would make
 * it false for exactly the person who checked before adopting.
 */
export function license() {
  const names = [...components(), { dir: SUITE_DIR }].map(({ dir }) => {
    const manifest = JSON.parse(read('packages', dir, 'package.json'))
    if (!manifest.license) throw new Error(`packages/${dir}/package.json: no license field`)
    return manifest.license
  })

  const [first, ...rest] = names
  if (rest.some((name) => name !== first)) {
    throw new Error(`packages differ on license: ${[...new Set(names)].join(', ')}`)
  }
  return first
}

/** The axe rule tags every a11y spec asserts zero violations against. */
export function axeTags() {
  const perPackage = components().map(({ dir }) => {
    const where = `packages/${dir}/e2e/a11y.spec.ts`
    const source = read('packages', dir, 'e2e', 'a11y.spec.ts')
    const call = /withTags\(\[([^\]]+)\]\)/.exec(source)
    if (!call) throw new Error(`${where}: no AxeBuilder .withTags([...]) call found`)
    return [...call[1].matchAll(/['"]([^'"]+)['"]/g)].map((match) => match[1])
  })

  return perPackage.reduce((shared, tags) => shared.filter((tag) => tags.includes(tag)))
}
