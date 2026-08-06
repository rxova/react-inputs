/**
 * The component registry, discovered rather than declared centrally.
 *
 * A component package identifies itself with an `rxova` block in its own
 * package.json:
 *
 *   "rxova": { "slug": "otp", "label": "OTP", "title": "OTP input" }
 *
 * Nothing here lists the packages, and neither does anything downstream — the
 * docs sidebar, the CI matrices and the playground all read this. Adding an
 * input means creating its directory; the tooling picks it up on the next run.
 *
 * The alternative, a central array, is the shape this repo kept drifting out of
 * sync with: a package could be published, documented and demoed while quietly
 * missing from a CI matrix, and nothing failed — the job just never ran for it.
 * A missing self-declaration is loud by comparison, because the package appears
 * nowhere at all.
 *
 * `.mjs` because the consumers are `.mjs` (astro.config, CI scripts) and plain
 * Node. Deliberately dependency-free and synchronous: it runs inside an Astro
 * config load and inside a GitHub Actions step.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** The repo root, from this file's location in packages/utils. */
export const REPO_ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..')

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))

/**
 * Every self-declared component package, alphabetically by label.
 *
 * Returns `{ dir, name, slug, label, title, description }` — `dir` is the directory under
 * packages/ and the segment CI uses, `name` the npm name, `slug` the URL and
 * route segment, `label` the sidebar entry, `title` a human heading.
 *
 * Display order is derived, not declared: a package's position in the list is
 * not a fact about that package, so nothing here asks it to name one. Sorting
 * by the displayed label keeps the order self-evident and stable as inputs come
 * and go — the alternative, a per-package `order` number, is a central ordered
 * list smeared across the manifests, the coupling this registry exists to shed.
 */
export function componentPackages(repoRoot = REPO_ROOT) {
  const packagesDir = join(repoRoot, 'packages')

  return readdirSync(packagesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      let manifest
      try {
        manifest = readJson(join(packagesDir, entry.name, 'package.json'))
      } catch {
        // Not a package (or mid-scaffold): nothing to declare, nothing to run.
        return []
      }

      const rxova = manifest.rxova
      if (!rxova?.slug) return []

      return [
        {
          dir: entry.name,
          name: manifest.name,
          slug: rxova.slug,
          label: rxova.label ?? rxova.slug,
          title: rxova.title ?? rxova.label ?? rxova.slug,
          description: manifest.description ?? rxova.title ?? rxova.label ?? rxova.slug,
        },
      ]
    })
    .sort(
      (a, b) =>
        a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }) ||
        a.slug.localeCompare(b.slug),
    )
}
