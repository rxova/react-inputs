import type { PackageManifest } from './manifest'

/**
 * The directory a package's build writes, and what it is built from. `dist` is
 * gitignored, so it never shows up in a diff: a change reaches it through the
 * source tsdown compiles and through tsdown's own config.
 */
const BUILD_OUTPUT = 'dist'
const BUILD_INPUT = /^(src\/|tsdown\.config\.[cm]?[jt]s$)/

/**
 * npm packs these whatever `files` says: the manifest, and a README and a
 * LICENSE (or LICENCE) at the package root, in any case and with any
 * extension.
 */
const ALWAYS_PACKED = /^(package\.json|(readme|license|licence)(\.[^/]*)?)$/i

/** Test code in any of the layouts the packages use. None of it is packed. */
const TEST_FILE = /(\.(test|spec)\.[cm]?[jt]sx?$|(^|\/)(__tests__|__fixtures__|e2e)\/)/

/**
 * Whether a path inside a package — relative to the package directory — ends
 * up in the tarball npm publishes, directly or by being compiled into `dist`.
 *
 * `files` entries match themselves and everything under them. Globs are not
 * expanded, because no package here uses one; an entry with a `*` in it is a
 * signal to teach this function about globs rather than to guess.
 */
export const isShippedPath = (path: string, manifest: PackageManifest): boolean => {
  if (TEST_FILE.test(path)) return false
  if (ALWAYS_PACKED.test(path)) return true

  const files = Array.isArray(manifest.files)
    ? manifest.files.filter((entry): entry is string => typeof entry === 'string')
    : []

  return files.some((raw) => {
    const entry = raw.replace(/^\.\//, '').replace(/\/+$/, '')
    if (entry.includes('*')) {
      throw new Error(`files entry "${raw}" is a glob, which is-shipped-path does not expand`)
    }
    if (entry === BUILD_OUTPUT && BUILD_INPUT.test(path)) return true
    return path === entry || path.startsWith(`${entry}/`)
  })
}
