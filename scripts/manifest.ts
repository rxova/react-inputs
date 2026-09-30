import { readFileSync } from 'node:fs'

/**
 * `JSON.parse` returns `any`, and this repo lints with `strictTypeChecked` — so
 * every manifest read used to produce a cascade of no-unsafe-* errors, and the
 * scripts were only quiet before because they were `.mjs` and the type-aware
 * rules never looked at them.
 *
 * Narrow on purpose: it describes the fields the tooling actually reads. An
 * index signature keeps it usable for anything else without widening to `any`.
 */
export interface PackageManifest {
  readonly name: string
  readonly version?: string
  readonly private?: boolean
  readonly scripts?: Readonly<Record<string, string>>
  readonly dependencies?: Readonly<Record<string, string>>
  readonly devDependencies?: Readonly<Record<string, string>>
  readonly exports?: unknown
  readonly [key: string]: unknown
}

export const readManifest = (path: string): PackageManifest =>
  JSON.parse(readFileSync(path, 'utf8')) as PackageManifest
