// One enumeration of the docs, shared by every agent-facing endpoint.
//
// The `.md` twins, llms.txt and llms-full.txt all describe the same set of pages.
// If each built its own list they would disagree — a page in one and not the
// other — and the disagreement would be invisible, because each output still
// looks complete on its own. So they all call `docsPages()`.
//
// This module imports `astro:content`, so it only resolves inside an Astro build.
// The rules worth testing live in docs-pages.mjs and mdx-to-markdown.mjs, which
// are plain modules; this file is the adapter between them and the collection.

import { getCollection } from 'astro:content'

import { withBase } from './base-url.mjs'
import { mdxToMarkdown } from './mdx-to-markdown.mjs'
import { HOME, sectionOf, mdRoute, htmlRoute, firstSentence } from './docs-pages.mjs'
import { recipesFor } from './recipe-sources.mjs'
import { manualA11yMarkdown } from './manual-a11y-proof.mjs'
import { frameworkCompatibilityMarkdown } from './framework-proof.mjs'

/**
 * The component list, injected by astro.config.mjs from `componentPackages()`.
 *
 * Not called directly here: `componentPackages()` resolves the repo root from its
 * own `import.meta.url`, and this module is bundled into a prerender chunk under
 * `dist/`, where that resolves to a directory that does not exist. The config runs
 * in plain node and already computes the list for the sidebar and the TypeDoc
 * instances, so it is the right place to read it — this stays one source of truth,
 * reached at the only point in the build that can reach it.
 */
const COMPONENTS = __RXOVA_COMPONENTS__

/**
 * A splash page is a landing page, not a document.
 *
 * The home page is built from bespoke Astro components fed by `lib/proof.mjs` — a
 * CTA band, a value grid, a size table — so its body holds almost no prose to
 * normalize, and what it does hold is marketing rather than reference. Serving a
 * hollowed-out `.md` of it would cost an agent a fetch and teach it nothing.
 * `overview.mdx` is the page that actually answers "what is this suite", and it is
 * ordinary prose.
 *
 * Keyed off frontmatter rather than an id list, so a second splash page excludes
 * itself.
 */
const isSplash = (entry) => entry.data.template === 'splash'

/**
 * Every documentation page, normalized to markdown and sorted by id.
 *
 * `origin` and `base` come from the caller's `import.meta.env`, so a preview build
 * links to itself rather than advertising production URLs.
 */
export async function docsPages({ origin, base = '/' }) {
  const toUrl = (pathname) => `${origin}${withBase(pathname, base)}`
  const entries = await getCollection('docs', (entry) => !isSplash(entry))

  return entries
    .map((entry) => {
      const body = entry.body ?? ''
      return {
        id: entry.id || HOME,
        title: entry.data.title,
        description: entry.data.description ?? firstSentence(body),
        section: sectionOf(entry.id || HOME, COMPONENTS),
        // The route is relative to this build's base, because that is what Astro
        // writes to disk. The URLs are absolute, because a `.md` read detached
        // from the site has nothing to resolve a relative link against.
        mdRoute: mdRoute(entry.id),
        htmlUrl: toUrl(htmlRoute(entry.id)),
        mdUrl: toUrl(mdRoute(entry.id)),
        body: mdxToMarkdown(body, {
          origin,
          base,
          recipesFor,
          manualA11yMatrix: manualA11yMarkdown(),
          frameworkCompatibilityMatrix: frameworkCompatibilityMarkdown(),
        }),
      }
    })
    .sort((a, b) => a.id.localeCompare(b.id, 'en'))
}
