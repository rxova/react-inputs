// What this site adds to @rxova/docs-kit: its own MDX constructs, how its pages
// divide into llms.txt sections, and the words an agent reads first. The generic
// pipeline (fence-aware rewriting, twins, the llmstxt.org shape) is docs-kit's
// and tested there; these pin the parts only this site can get wrong — each of
// which fails silently, leaving output that still looks complete.

import { describe, it } from "vitest";
import assert from "node:assert/strict";

import { groupPages, llmsIndex, mapUnfenced } from "@rxova/docs-kit";

import {
  expandCodeRecipes,
  expandFrameworkCompatibilityTable,
  expandLiveExamples,
  installPreamble,
  llmsOptions,
  sectionOf,
  stripLiveMeta,
} from "./site-markdown.mjs";

/** As componentPackages() returns them. */
const COMPONENTS = [
  {
    slug: "currency",
    label: "Currency",
    title: "Currency input",
    name: "@rxova/react-intl-currency-input",
  },
  { slug: "otp", label: "OTP", title: "OTP input", name: "@rxova/react-otp-input" },
];

describe("stripLiveMeta", () => {
  it("drops the live marker, which is not a language", () => {
    assert.equal(stripLiveMeta("```tsx live"), "```tsx");
  });

  it("leaves an ordinary fence untouched", () => {
    assert.equal(stripLiveMeta("```tsx"), "```tsx");
    assert.equal(stripLiveMeta("```sh"), "```sh");
  });
});

describe("expandLiveExamples", () => {
  it("turns the hand-written island back into the fence it was authored as", () => {
    const out = expandLiveExamples(
      "<LiveExample\n  code={`function A() {\n  return <b />\n}`}\n/>",
    );
    assert.equal(out, "```tsx\nfunction A() {\n  return <b />\n}\n```");
  });

  it("undoes the template-literal escaping a fence does not want", () => {
    const out = expandLiveExamples("<LiveExample code={`const a = \\`x\\${y}\\``} />");
    assert.match(out, /const a = `x\$\{y\}`/);
  });
});

describe("expandCodeRecipes", () => {
  const load = (slug) => [{ label: "Material UI", href: "https://mui.com", source: `// ${slug}` }];

  it("turns the authored component into labelled copy-paste code", () => {
    const output = expandCodeRecipes(
      `<CodeRecipes idPrefix="integration" recipes={recipesFor('otp')} />`,
      load,
    );

    assert.match(output, /^### \[Material UI\]\(https:\/\/mui\.com\)$/m);
    assert.match(output, /```tsx\n\/\/ otp\n```/);
  });

  // Prettier formats MDX, and the shared preset writes double quotes.
  it("reads the slug whichever quotes the page uses", () => {
    const output = expandCodeRecipes(`<CodeRecipes recipes={recipesFor("otp")} />`, load);
    assert.match(output, /```tsx\n\/\/ otp\n```/);
  });

  it("does not expand a component-looking line inside a fence", () => {
    const source = ["```mdx", `<CodeRecipes recipes={recipesFor('otp')} />`, "```"].join("\n");
    assert.equal(
      mapUnfenced(source, (chunk) => expandCodeRecipes(chunk, () => [])),
      source,
    );
  });
});

describe("expandFrameworkCompatibilityTable", () => {
  const authored = [
    "<DataTable",
    '  label="Framework compatibility"',
    "  columns={['Framework']}",
    "  rows={frameworkCompatibility.map((row) => ({ label: row.label, cells: [] }))}",
    "/>",
  ].join("\n");

  it("turns the authored table, over several lines, into the derived proof table", () => {
    assert.equal(
      expandFrameworkCompatibilityTable(`before\n\n${authored}\n\nafter`, "| Vite | pass |"),
      "before\n\n| Vite | pass |\n\nafter",
    );
  });

  it("leaves any other DataTable alone", () => {
    const other = '<DataTable label="Browsers" columns={[]} rows={[]} />';
    assert.equal(expandFrameworkCompatibilityTable(other, "proof"), other);
  });

  it("does not expand a component-looking block inside a fence", () => {
    const source = ["```mdx", authored, "```"].join("\n");
    assert.equal(
      mapUnfenced(source, (chunk) => expandFrameworkCompatibilityTable(chunk, "proof")),
      source,
    );
  });
});

describe("sectionOf", () => {
  it("groups a component page under its own slug", () => {
    assert.equal(sectionOf("components/otp/usage", COMPONENTS), "otp");
    assert.equal(sectionOf("components/currency/introduction", COMPONENTS), "currency");
  });

  // Generated reference belongs under llms.txt's "Optional" heading, not mixed
  // in with the prose an agent should read first.
  it("separates generated reference from prose", () => {
    assert.equal(sectionOf("components/otp/api", COMPONENTS), "api:otp");
    assert.equal(sectionOf("components/otp/api/interfaces/otpinputprops", COMPONENTS), "api:otp");
  });

  it('does not mistake a page merely starting with "api" for reference', () => {
    assert.equal(sectionOf("components/otp/apidesign", COMPONENTS), "otp");
  });

  it("handles the pages that belong to no component", () => {
    assert.equal(sectionOf("index", COMPONENTS), "root");
    assert.equal(sectionOf("overview", COMPONENTS), "root");
    assert.equal(sectionOf("getting-started/installation", COMPONENTS), "getting-started");
    assert.equal(sectionOf("guides/whatever", COMPONENTS), "other");
  });

  // The guarantee that a new component needs no edit in this file.
  it("sections a component it has never heard of, from the manifest list alone", () => {
    const withNew = [...COMPONENTS, { slug: "colour", label: "Colour" }];
    assert.equal(sectionOf("components/colour/usage", withNew), "colour");
    assert.equal(sectionOf("components/colour/api", withNew), "api:colour");
  });
});

const page = (id, section, over = {}) => ({
  id,
  section,
  title: id,
  description: `About ${id}.`,
  mdRoute: `/${id}.md`,
  mdUrl: `https://rxova.dev/packages/react-inputs/${id}.md`,
  htmlUrl: `https://rxova.dev/packages/react-inputs/${id}/`,
  body: `Body of ${id}.`,
  ...over,
});

const PAGES = [
  page("overview", "root"),
  page("getting-started/installation", "getting-started"),
  page("components/currency/usage", "currency"),
  page("components/otp/usage", "otp"),
  page("components/otp/api/interfaces/otpinputprops", "api:otp", { title: "OtpInputProps" }),
];

const MOUNT = "https://rxova.dev/packages/react-inputs";

describe("llmsOptions", () => {
  it("orders sections the way a reader should meet them, npm names in the headings", () => {
    const { groups } = groupPages(PAGES, llmsOptions(COMPONENTS));
    assert.deepEqual(
      groups.map((g) => g.heading),
      [
        "About",
        "Getting started",
        "Currency input (@rxova/react-intl-currency-input)",
        "OTP input (@rxova/react-otp-input)",
      ],
    );
  });

  it("separates generated reference into the optional pile", () => {
    const { optional } = groupPages(PAGES, llmsOptions(COMPONENTS));
    assert.deepEqual(
      optional.map((p) => p.id),
      ["components/otp/api/interfaces/otpinputprops"],
    );
  });

  // The guarantee that a new component needs no edit in this file.
  it("gives a component it has never heard of its own heading, from the manifest", () => {
    const withNew = [
      ...COMPONENTS,
      { slug: "colour", title: "Colour input", name: "@rxova/react-colour-input" },
    ];
    const { groups } = groupPages(
      [page("components/colour/usage", "colour")],
      llmsOptions(withNew),
    );
    assert.deepEqual(
      groups.map((g) => g.heading),
      ["Colour input (@rxova/react-colour-input)"],
    );
  });

  // A TypeDoc page's description restates its title, so it doubles the section
  // for nothing; the one intro line already says what they all are.
  it("does not repeat a description for every generated reference page", () => {
    const doc = llmsIndex(PAGES, { ...llmsOptions(COMPONENTS), mount: MOUNT });
    const optional = doc.split("## Optional")[1];
    assert.match(optional, /Generated TypeScript reference/);
    assert.match(optional, /^- \[OtpInputProps\]\(\S+\)$/m);
  });
});

describe("installPreamble", () => {
  // An install path an agent cannot discover is worth nothing, and `shadcn add`
  // is the verb it will reach for first in a React project.
  it("gives both install paths, with registry URLs under the mount", () => {
    const doc = installPreamble(COMPONENTS, MOUNT).join("\n");

    assert.match(doc, /^## Install$/m);
    assert.match(doc, /npm install @rxova\/react-inputs/);
    assert.match(
      doc,
      /npx shadcn@latest add https:\/\/rxova\.dev\/packages\/react-inputs\/r\/otp-field\.json/,
    );
    assert.match(doc, /https:\/\/rxova\.dev\/packages\/react-inputs\/r\/registry\.json/);
    assert.match(doc, /currency-field, otp-field/);
  });
});
