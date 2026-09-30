import { visit } from "unist-util-visit";

import { withBase } from "@rxova/docs-kit";

/**
 * Prefixes the site-root-relative links in page content with the configured `base`.
 *
 * Docusaurus rewrote `/components/otp/about` to `<baseUrl>/components/otp/about`
 * for you; Astro does not. Every page here was written against that behaviour, so
 * under the rxova.dev aggregator (DOCS_BASE_URL=/packages/react-inputs/) all 85 of
 * them 404'd — which is what starlight-links-validator caught. The standalone
 * build hides it: with base '/' the links happen to be correct.
 *
 * The alternative was rewriting the prose to use relative `./sibling.md` links,
 * which Starlight also resolves through `base`. That works, but it puts the
 * burden on every future edit — one absolute link slipped into a new page is a
 * 404 that only shows up on the deployed site. Doing it here means authors keep
 * writing the paths the site actually has.
 *
 * Frontmatter hero links are NOT content: Starlight renders those from the
 * collection entry, which never goes through remark. They are handled at render
 * time in `src/route-middleware.mjs` — this plugin rewrites its own copy of them
 * only so the link validator, which reads the remark frontmatter, checks the URL
 * that actually ships.
 */
export default function remarkBaseLinks({ base = "/" } = {}) {
  // Standalone build: nothing to prefix.
  if (base.replace(/\/+$/, "") === "") return () => {};

  // Only strings: a JSX attribute written as an expression (`src={…}`) carries
  // an estree node here, which is the author's own code and left alone.
  const rewrite = (url) => (typeof url === "string" ? withBase(url, base) : url);

  return (tree, file) => {
    for (const action of file.data?.astro?.frontmatter?.hero?.actions ?? []) {
      action.link = rewrite(action.link);
    }

    visit(tree, (node) => {
      // Markdown links and images, plus the reference-style definitions they
      // point at.
      if (node.type === "link" || node.type === "image" || node.type === "definition") {
        node.url = rewrite(node.url);
        return;
      }

      // JSX in .mdx — `<a href="/...">`, `<img src="/...">`. Only plain string
      // attributes: an expression value is the author's own code, and the pages
      // that need one already use `import.meta.env.BASE_URL`.
      if (node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") {
        for (const attribute of node.attributes ?? []) {
          if (attribute.type !== "mdxJsxAttribute") continue;
          if (attribute.name !== "href" && attribute.name !== "src") continue;
          attribute.value = rewrite(attribute.value);
        }
      }
    });
  };
}
