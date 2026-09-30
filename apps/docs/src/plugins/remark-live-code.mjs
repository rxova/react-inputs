import { visit } from "unist-util-visit";

/**
 * Rewrites ```tsx live fences into <LiveExample code="..." /> at build time.
 *
 * The alternative was to bake `<LiveExample>` calls into the markdown during
 * the migration, but that would have made every future example uglier to write
 * than it was under Docusaurus — a bad trade for a component library whose
 * examples are the product. Keeping the fence means the 29 existing blocks
 * migrate untouched and authors carry on as before.
 *
 * The component is injected as an MDX element, so any page using a live fence
 * has to be .mdx. The migration script converts those files.
 */
export default function remarkLiveCode() {
  return (tree, file) => {
    let used = false;

    visit(tree, "code", (node, index, parent) => {
      // Docusaurus marked these as ```tsx live / ```jsx live.
      if (!node.meta?.split(/\s+/).includes("live")) return;
      if (!parent || index === null) return;

      used = true;
      parent.children[index] = {
        type: "mdxJsxFlowElement",
        name: "LiveExample",
        attributes: [{ type: "mdxJsxAttribute", name: "code", value: node.value }],
        children: [],
      };
    });

    if (!used) return;

    // Only import the component on pages that actually use it, so the island's
    // JavaScript is not shipped to every page in the site.
    tree.children.unshift({
      type: "mdxjsEsm",
      value: "import LiveExample from '@components/LiveExample.astro'",
      data: {
        estree: {
          type: "Program",
          sourceType: "module",
          body: [
            {
              type: "ImportDeclaration",
              specifiers: [
                {
                  type: "ImportDefaultSpecifier",
                  local: { type: "Identifier", name: "LiveExample" },
                },
              ],
              source: { type: "Literal", value: "@components/LiveExample.astro" },
            },
          ],
        },
      },
    });

    file.data.astro ??= {};
  };
}
