// What this site adds to @rxova/docs-kit's agent-facing pipeline.
//
// docs-kit turns every page into its `.md` twin and builds llms.txt and
// llms-full.txt from the same list. Everything generic lives there: fence-aware
// rewriting, Starlight layout components, import stripping, absolute links, the
// llmstxt.org shape. What stays here is what only this site has — three MDX
// constructs of its own that must come back out as the Markdown they stand for,
// how its pages divide into sections, and the words an agent reads first.
//
// Everything here is pure, so it is tested without Astro (site-markdown.test.mjs).
// docs-md.mjs is the adapter that hands it the collection.

/** `` ```tsx live `` marks an editable example in the site. It is not a language. */
export function stripLiveMeta(fenceLine) {
  return fenceLine.replace(/^(\s*(?:`{3,}|~{3,})\s*[\w-]*)\s+live\b\s*$/, "$1");
}

/**
 * `<LiveExample code={`…`} />` back into the fence it was authored as.
 *
 * The site turns ```` ```tsx live ```` fences into these islands at build time, but
 * index.mdx writes three of them by hand because they need to be the page's whole
 * section. Reversing it here means both spellings reach a reader as one thing.
 */
export function expandLiveExamples(text) {
  return text.replace(
    /^[ \t]*<LiveExample\s+code=\{`([\s\S]*?)`\}\s*\/>[ \t]*$/gm,
    (_, code) =>
      // Undo template-literal escaping: inside code={`…`} a literal backtick or
      // interpolation opener has to be escaped, and a fence needs them raw.
      "```tsx\n" + code.replace(/\\`/g, "`").replace(/\\\$\{/g, "${") + "\n```",
  );
}

/** `<CodeRecipes … recipes={recipesFor('otp')} />` into the exact compiled recipe sources. */
export function expandCodeRecipes(text, loadRecipes = () => []) {
  return text.replace(
    /^[ \t]*<CodeRecipes\b[^>\n]*\brecipes=\{recipesFor\((['"])([^'"]+)\1\)\}[^>\n]*\/>[ \t]*$/gm,
    (_, _quote, slug) =>
      loadRecipes(slug)
        .map(
          ({ label, href, source }) =>
            `### [${label}](${href})\n\n\`\`\`tsx\n${source.trim()}\n\`\`\``,
        )
        .join("\n\n"),
  );
}

/** The compatibility page's `<DataTable label="Framework compatibility" … />`, over several lines, into the derived proof table. */
export function expandFrameworkCompatibilityTable(text, matrix = "") {
  return text.replace(
    /^[ \t]*<DataTable\s+label="Framework compatibility"[\s\S]*?\/>[ \t]*$/gm,
    matrix,
  );
}

/**
 * Which part of the site a page belongs to, as llms.txt sections.
 *
 * `components` is the manifest-derived list from `componentPackages()`, so a
 * new component sections itself with no edit here.
 *
 * `api:<slug>` is deliberately distinct from `<slug>`: the generated TypeDoc
 * reference belongs under llms.txt's "Optional" heading — the spec's designated
 * place for "drop this if you are short on context" — not interleaved with prose.
 */
export function sectionOf(id, components) {
  if (id === "index" || id === "overview") return "root";
  if (id.startsWith("getting-started/")) return "getting-started";

  for (const { slug } of components) {
    if (id === `components/${slug}` || id.startsWith(`components/${slug}/`)) {
      return id === `components/${slug}/api` || id.startsWith(`components/${slug}/api/`)
        ? `api:${slug}`
        : slug;
    }
  }
  return "other";
}

/**
 * The suite's own summary, as the blockquote llmstxt.org puts under the H1.
 *
 * Written here rather than taken from a page's frontmatter: the home page is a
 * marketing splash and `overview` opens with a sentence aimed at a human browsing.
 * This is the paragraph an agent needs first — what the packages are, and the two
 * constraints (`no stylesheet`, `zero dependencies`) that change how it writes the
 * calling code.
 */
const SUMMARY = [
  "Headless, accessible, zero-dependency React input components: locale-aware",
  "currency, fractional ratings, one-time codes, passwords, international phone",
  "numbers, segmented date and time fields, tags and files. One native <input>",
  "where it matters, so paste, autofill, IME and native form submission come from",
  "the platform. No stylesheet to import — styling is CSS custom properties named",
  "--rx-<component>-* and data-rx-<component>-* attributes, plus unprefixed state",
  "hooks (data-invalid, data-disabled, data-readonly, data-focused) shared across",
  "the suite. Each onChange emits a plain value, never an event. React >= 18 is",
  "the only peer dependency.",
];

/**
 * The llms.txt / llms-full.txt settings docs-kit takes, in the order a reader
 * should meet the sections: the framing pages, getting started, one heading per
 * component, then the generated reference under `## Optional`.
 *
 * The npm name belongs in a component's heading: it is what an agent has to
 * install, and one heading per component is where it will look for it.
 */
export function llmsOptions(components) {
  return {
    project: "Rxova React Inputs",
    summary: SUMMARY,
    sections: [
      ["root", "About"],
      ["getting-started", "Getting started"],
      ...components.map(({ slug, title, label, name }) => {
        const heading = title ?? label ?? slug;
        return [slug, name ? `${heading} (${name})` : heading];
      }),
    ],
    optional: {
      match: (section) => section.startsWith("api:"),
      // No per-entry note: a TypeDoc page's description repeats its title ("The
      // props for OtpInput"), so it would double the section's size and add
      // nothing. This one line says what the whole section is.
      intro: ["Generated TypeScript reference — exact prop types, defaults and return shapes."],
    },
  };
}

/**
 * The install section of llms.txt: the meta-package, and the shadcn registry
 * items, whose URLs sit under the mount — a registry URL that dropped the
 * /packages/react-inputs/ prefix would 404 in the one place it is meant to be
 * pasted.
 */
export function installPreamble(components, mount) {
  const registryNames = components.map(({ slug }) => `${slug}-field`);
  return [
    "## Install",
    "",
    "Either install the package and import it:",
    "",
    "    npm install @rxova/react-inputs",
    "    import { CurrencyInput, Rating, OtpInput } from '@rxova/react-inputs'",
    "",
    "That meta-package re-exports all three components, and is what every example",
    "below imports from. The individual packages —",
    "`@rxova/react-intl-currency-input`, `@rxova/react-rating-input`,",
    "`@rxova/react-otp-input` — are published separately and are equivalent, but",
    "importing from one of those names requires installing that package too.",
    "",
    "Every input is controlled and emits its **value** through `onChange`, never a",
    "DOM event: `number | null` (plus a `meta` object) for currency, `number` for",
    "rating, `string` for OTP.",
    "",
    "or copy a pre-wired field component in, with `shadcn`:",
    "",
    `    npx shadcn@latest add ${mount}/r/otp-field.json`,
    "",
    `Registry index: ${mount}/r/registry.json — ${registryNames.join(", ")}.`,
    "Each item copies a label/description/error wrapper plus a stylesheet into",
    "your project and keeps the component itself as a versioned npm dependency.",
    "",
  ];
}
