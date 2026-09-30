/**
 * Types for component-packages.mjs.
 *
 * The module is `.mjs` so an Astro config and a bare `node` call can import it
 * without a build step; this file is what lets the TypeScript tooling in this
 * package import it too, instead of each consumer re-implementing the scan.
 */

export interface ComponentPackage {
  /** Directory under packages/, and the segment CI addresses it by. */
  readonly dir: string
  /** The npm package name. */
  readonly name: string
  /** URL and content-directory segment. */
  readonly slug: string
  /** Sidebar entry — not always the slug capitalised (OTP). */
  readonly label: string
  /** Human heading, e.g. "OTP input". */
  readonly title: string
}

export declare const REPO_ROOT: string

export declare function componentPackages(repoRoot?: string): ComponentPackage[]
