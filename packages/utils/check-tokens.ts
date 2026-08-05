/**
 * Fails when a component emits a styling hook outside its own namespace.
 *
 * Every CSS custom property and every structural `data-*` attribute a component
 * paints is public API — `AGENTS.md` and `CONTRIBUTING.md` both say so, and the
 * whole styling story is "there is no stylesheet, target these instead". So the
 * names are a compatibility surface, and until this check existed each package
 * picked its own prefix from its initials. That produced `--rpi-` for password
 * and `--rphi-` for phone, `--rfs-` for rating and `--rfi-` for file: pairs one
 * character apart, on components that routinely appear in the same form. Custom
 * properties inherit, so setting the wrong one is inert rather than an error —
 * the failure mode is a knob that silently does nothing.
 *
 * The rule: a hook is either namespaced `--rx-<slug>-*` / `data-rx-<slug>-*`
 * with the package's own slug, or it is one of the shared state hooks below,
 * which mean the same thing everywhere and are deliberately not namespaced —
 * `[data-invalid]` should style every input in the suite with one selector.
 *
 * Text-scanned rather than parsed. These names are string literals in JSX
 * attributes and in `var()` calls inside style objects, so a regex sees exactly
 * what ships; a TypeScript AST walk would have to reassemble the same strings
 * from template literals to learn less.
 *
 * Scans what the component paints, not `__tests__`: a test legitimately passes
 * arbitrary `data-*` through the component to prove it forwards them, and a
 * stale selector in a test already fails loudly by querying nothing.
 *
 * Offline: reads files only.
 *
 * Usage: `node --import tsx ./packages/utils/check-tokens.ts [repoRoot]`.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

import { componentPackages } from './component-packages.mjs'

/**
 * Hooks that describe a state rather than a part, and so are shared.
 *
 * A consumer styling "every invalid field in this form" writes one selector.
 * Namespacing these would make that nine selectors and would say nothing extra:
 * `data-invalid` on a date field and on a rating mean the same thing.
 */
export const SHARED_STATE_HOOKS: ReadonlySet<string> = new Set([
  'data-active',
  'data-complete',
  'data-count',
  'data-country',
  'data-disabled',
  'data-dragging',
  'data-filled',
  'data-fill',
  'data-focused',
  'data-full',
  'data-idx',
  'data-invalid',
  'data-met',
  'data-out-of-range',
  'data-placeholder',
  'data-possible',
  'data-readonly',
  'data-revealed',
  'data-rule',
  'data-score',
  'data-state',
  'data-valid',
])

/**
 * `data-*` names that are not styling hooks at all.
 *
 * `data-testid` belongs to the demos and the e2e specs; React's own
 * `data-reactroot` and the like are not ours to name.
 */
const IGNORED_DATA_ATTRIBUTES = /^data-(testid|react|nosnippet$)/

export interface Failure {
  readonly package: string
  readonly reason: string
}

/** Every `.ts`/`.tsx` file a package ships, recursively, excluding its tests. */
function sourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return []

  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const child = join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(child)
    return /\.tsx?$/.test(entry.name) ? [child] : []
  })
}

/**
 * Custom properties a file reads, as they appear (`--rx-otp-gap`).
 *
 * Scoped to `var(…)` rather than to every `--foo` in the text. That is exactly
 * where a component names a knob — no package in the suite assigns a custom
 * property, they all only read one with a fallback — and anchoring on `var(`
 * keeps a bare `--` in prose or in an unrelated string out of the results.
 */
export function customProperties(source: string): string[] {
  return [...source.matchAll(/var\(\s*(--[a-z][\w-]*)/g)]
    .map((match) => match[1])
    .filter((name): name is string => name !== undefined)
}

/**
 * Structural `data-*` attributes named in a file.
 *
 * Matches the three forms a name actually reaches the DOM through — the JSX
 * attribute (`data-rx-otp-root=""`), the object-literal key that prop-getters
 * return (`'data-rx-otp-root': ''`), and the selector (`[data-rx-otp-root]`).
 * Requiring one of those trailing characters is what keeps prose out: a comment
 * describing the `data-rx-<slug>-*` convention is not an attribute.
 */
export function dataAttributes(source: string): string[] {
  return [...source.matchAll(/\bdata-[a-z][\w-]*(?=[=\]'"])/g)].map((match) => match[0])
}

export function checkTokens(repoRoot: string = process.cwd()): Failure[] {
  const failures: Failure[] = []

  for (const pkg of componentPackages(repoRoot)) {
    const namespace = `rx-${pkg.slug}-`
    const seen = new Set<string>()

    for (const file of sourceFiles(join(repoRoot, 'packages', pkg.dir, 'src'))) {
      const source = readFileSync(file, 'utf8')
      const where = relative(repoRoot, file)

      for (const property of customProperties(source)) {
        if (property.startsWith(`--${namespace}`)) continue
        if (seen.has(`${property} ${where}`)) continue
        seen.add(`${property} ${where}`)
        failures.push({
          package: pkg.name,
          reason: `${where} names \`${property}\`, which is not \`--${namespace}*\``,
        })
      }

      for (const attribute of dataAttributes(source)) {
        if (attribute.startsWith(`data-${namespace}`)) continue
        if (SHARED_STATE_HOOKS.has(attribute)) continue
        if (IGNORED_DATA_ATTRIBUTES.test(attribute)) continue
        if (seen.has(`${attribute} ${where}`)) continue
        seen.add(`${attribute} ${where}`)
        failures.push({
          package: pkg.name,
          reason: `${where} names \`${attribute}\`, which is neither \`data-${namespace}*\` nor a shared state hook`,
        })
      }
    }
  }

  return failures
}

export function formatFailures(failures: Failure[]): string {
  const details = failures.map(({ package: name, reason }) => `  ✗ ${name} ${reason}`)
  return `${String(failures.length)} styling-token problem(s):\n${details.join('\n')}`
}

const isEntrypoint =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href

if (isEntrypoint) {
  const [repoRoot = process.cwd()] = process.argv.slice(2)
  const failures = checkTokens(resolve(repoRoot))

  if (failures.length > 0) {
    console.error(formatFailures(failures))
    process.exit(1)
  }

  console.log('✔ Every styling hook is namespaced to the component that paints it')
}
