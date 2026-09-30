// One enumeration of the docs, shared by every agent-facing endpoint.
//
// The `.md` twins, llms.txt and llms-full.txt all describe the same set of pages.
// If each built its own list they would disagree — a page in one and not the
// other — and the disagreement would be invisible, because each output still
// looks complete on its own. So they all call `docsPages()`.
//
// This module imports `astro:content`, so it only resolves inside an Astro build.
// The pipeline is @rxova/docs-kit's; what this site adds to it lives in
// site-markdown.mjs, which is plain and tested.

import { getCollection } from "astro:content";
import { docsPages as buildPages } from "@rxova/docs-kit";

import {
  expandCodeRecipes,
  expandFrameworkCompatibilityTable,
  expandLiveExamples,
  sectionOf,
  stripLiveMeta,
} from "./site-markdown.mjs";
import { recipesFor } from "./recipe-sources.mjs";
import { frameworkCompatibilityMarkdown } from "./framework-proof.mjs";

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
const COMPONENTS = __RXOVA_COMPONENTS__;

/**
 * Every documentation page, normalized to markdown and sorted by id.
 *
 * `origin` and `base` come from the caller's `import.meta.env`, so a preview build
 * links to itself rather than advertising production URLs. Splash pages (the home
 * page, built from Astro components fed by `lib/proof.mjs`) are left out by
 * docs-kit's default: a hollowed-out `.md` of a landing page teaches an agent
 * nothing, and `overview.mdx` is the page that answers "what is this suite".
 */
export async function docsPages({ origin, base = "/" }) {
  return buildPages(await getCollection("docs"), {
    origin,
    base,
    sectionOf: (id) => sectionOf(id, COMPONENTS),
    markdown: {
      // Run first, on unfenced text only, each free to emit fences.
      expand: [
        (chunk) => expandCodeRecipes(chunk, recipesFor),
        (chunk) => expandFrameworkCompatibilityTable(chunk, frameworkCompatibilityMarkdown()),
        expandLiveExamples,
      ],
      fenceOpen: stripLiveMeta,
    },
  });
}
