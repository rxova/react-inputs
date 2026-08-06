// Hand-written types for docs-pages.mjs, matching the convention
// packages/utils/component-packages.d.mts already sets: the module stays plain
// JavaScript so plain `node` can run it, and the shape it produces is declared
// here for the TypeScript endpoints that consume it.

/** One documentation page, as the agent-facing endpoints consume it. */
export interface DocsPage {
  /** Collection id, with the home page's empty id replaced by `index`. */
  id: string
  title: string
  /** Frontmatter description, or the body's first sentence. */
  description?: string
  /** `root` | `getting-started` | a component slug | `api:<slug>` | `other`. */
  section: string
  /** Route this page's markdown twin is written to, relative to the build base. */
  mdRoute: string
  /** Absolute URL of the human page. */
  htmlUrl: string
  /** Absolute URL of the markdown twin. */
  mdUrl: string
  /** The page body, already normalized to plain markdown. */
  body: string
}

/** As `componentPackages()` returns them. */
export interface ComponentRef {
  slug: string
  label?: string
  title?: string
  name?: string
  description?: string
}

export declare const HOME: string
export declare function mdRoute(id: string): string
export declare function htmlRoute(id: string): string
export declare function sectionOf(id: string, components: ComponentRef[]): string
export declare function firstSentence(body: string): string | undefined
export declare function renderMarkdown(page: DocsPage): string
