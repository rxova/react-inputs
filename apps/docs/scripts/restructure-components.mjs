/**
 * Reshapes the per-component docs into one identical five-part structure:
 *
 *   Introduction · Usage · About · Migrating · API
 *
 * The Docusaurus site had a different page set per component (currency had
 * "formatting" and "localization", otp had "webotp" and "spatial-slots", …) plus
 * three cross-cutting guides that covered all three components in tabs. That is
 * fine to read but impossible to navigate: every component looked different, so
 * you had to relearn the layout for each one.
 *
 * Here the shared guides are split back apart — each component's tab is lifted
 * into its own About page — and the migration guides are filed under the
 * component they migrate to. The API section stays generated.
 */

import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  existsSync,
  readdirSync,
  statSync,
} from "node:fs";
import { join, dirname } from "node:path";

const DOCS = "src/content/docs";

/** Shared guides, and the heading each tab sits under (blank = whole page). */
const SHARED_GUIDES = [
  { file: "guides/accessibility.mdx", title: "Accessibility" },
  { file: "guides/styling.mdx", title: "Styling" },
  { file: "guides/form-libraries.mdx", title: "Form libraries" },
];

const COMPONENTS = {
  currency: {
    label: "Currency",
    tab: "Currency",
    overview: "components/currency.mdx",
    introduction: ["components/currency/why.md"],
    usage: ["components/currency/formatting.md"],
    about: ["components/currency/localization.mdx", "components/currency/ui-libraries.md"],
    migrating: ["migrating/from-react-currency-input-field.md"],
  },
  rating: {
    label: "Rating",
    tab: "Rating",
    overview: "components/rating.mdx",
    introduction: ["components/rating/why.md"],
    usage: ["components/rating/display.mdx", "components/rating/interactive.mdx"],
    about: ["components/rating/custom-icons.md", "components/rating/forms.md"],
    migrating: [
      "migrating/from-react-rating.md",
      "migrating/from-react-stars.md",
      "migrating/from-radio-buttons.md",
    ],
  },
  otp: {
    label: "OTP",
    tab: "OTP",
    overview: "components/otp.mdx",
    introduction: ["components/otp/why.md"],
    usage: ["components/otp/spatial-slots.md", "components/otp/codes-and-autofill.md"],
    about: [
      "components/otp/webotp.md",
      "components/otp/custom-slots.mdx",
      "components/otp/forms.md",
    ],
    migrating: ["migrating/from-input-otp.md", "migrating/from-react-otp-input.md"],
  },
};

/**
 * Pages that carry a live code fence are promoted to .mdx during migration, so
 * a path written here as .md may exist as either. Resolve both.
 */
const resolve = (rel) => {
  for (const candidate of [rel, rel.replace(/\.mdx?$/, ".mdx"), rel.replace(/\.mdx?$/, ".md")]) {
    const p = join(DOCS, candidate);
    if (existsSync(p)) return p;
  }
  return null;
};

/** Every markdown/MDX file under a directory. */
function walkDocs(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walkDocs(full, out);
    else if (/\.mdx?$/.test(entry)) out.push(full);
  }
  return out;
}

const read = (rel) => {
  const p = resolve(rel);
  return p ? readFileSync(p, "utf8") : null;
};

/** Strip frontmatter, returning { data, body }. */
function split(text) {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  if (!m) return { fm: "", body: text };
  return { fm: m[1], body: text.slice(m[0].length) };
}

const titleOf = (fm) => {
  const m = /^title:\s*(.+)$/m.exec(fm);
  return m ? m[1].trim().replace(/^['"]|['"]$/g, "") : null;
};

/** Every `import ...` line, so a merged page keeps what its parts needed. */
// Only the file's real MDX imports — NOT the `import` lines that appear inside
// fenced code blocks, which are example code (showing MUI, Chakra, antd usage).
// Hoisting those produced duplicate bindings and unresolvable packages, and
// stripping them corrupted the very examples they belonged to.
const FENCE = /^```[\s\S]*?^```/gm;
const outsideFences = (body) =>
  body.replace(FENCE, (m) => m.replace(/^import /gm, "\u0000import "));
const importsOf = (body) => outsideFences(body).match(/^import .+$/gm) ?? [];
const withoutImports = (body) =>
  outsideFences(body)
    .replace(/^import .+$\n?/gm, "")
    .replace(/\u0000import /g, "import ");

/**
 * Pull one component's tab out of a shared guide.
 *
 * accessibility/styling have a single Tabs block; form-libraries has one per
 * topic, so the `##` headings between them are preserved and only the matching
 * TabItem is kept under each.
 */
function extractTab(text, label) {
  const { body } = split(text);
  const out = [];
  const tabRe = new RegExp(`<TabItem label="${label}"[^>]*>([\\s\\S]*?)</TabItem>`, "g");

  // Headings that introduce each Tabs block, in document order.
  const sections = body.split(/^(?=## )/m);
  for (const section of sections) {
    const heading = /^## .+$/m.exec(section);
    const matches = [...section.matchAll(tabRe)];
    if (!matches.length) continue;
    if (heading && sections.length > 1) out.push(heading[0]);
    for (const m of matches) out.push(m[1].trim());
  }
  return out.join("\n\n");
}

const frontmatter = (title, order) =>
  `---\ntitle: ${JSON.stringify(title)}\nsidebar:\n  order: ${order}\n---\n\n`;

/** Merge several source pages into one, keeping their H2s as section breaks. */
function merge(paths, { demote = false } = {}) {
  const parts = [];
  const imports = new Set();
  for (const rel of paths) {
    const raw = read(rel);
    if (!raw) {
      console.warn(`  ! missing ${rel}`);
      continue;
    }
    const { fm, body } = split(raw);
    importsOf(body).forEach((i) => imports.add(i));
    let text = withoutImports(body).trim();
    // A merged page needs the source's title as a section heading, or the
    // reader loses the boundary between what used to be separate pages.
    const t = titleOf(fm);
    if (t && demote) text = `## ${t}\n\n${text.replace(/^##\s/gm, "### ")}`;
    parts.push(text);
  }
  return { imports: [...imports], body: parts.join("\n\n") };
}

let written = 0;
for (const [name, cfg] of Object.entries(COMPONENTS)) {
  const dir = join(DOCS, "components", name);
  mkdirSync(dir, { recursive: true });

  const emit = (file, title, order, { imports, body }) => {
    const head = imports.length ? imports.join("\n") + "\n\n" : "";
    writeFileSync(join(dir, file), frontmatter(title, order) + head + body.trim() + "\n");
    written++;
  };

  // 1. Introduction — why it exists, with the overview's opening pitch.
  const overview = read(cfg.overview);
  const intro = merge(cfg.introduction);
  if (overview) {
    const { body } = split(overview);
    // The overview page led with the pitch, the demo gif and a first snippet:
    // everything before its first H2 belongs at the top of Introduction.
    const pitch = withoutImports(body).split(/^## /m)[0].trim();
    intro.imports.push(...importsOf(body));
    intro.body = `${pitch}\n\n${intro.body}`;
    intro.imports = [...new Set(intro.imports)];
  }
  emit("introduction.mdx", "Introduction", 1, intro);

  // 2. Usage — the overview's own body plus the how-to pages.
  const usage = merge(cfg.usage, { demote: true });
  if (overview) {
    const { body } = split(overview);
    const rest = withoutImports(body)
      .split(/^(?=## )/m)
      .slice(1)
      .join("");
    if (rest.trim()) {
      usage.body = `${rest.trim()}\n\n${usage.body}`;
      usage.imports = [...new Set([...usage.imports, ...importsOf(body)])];
    }
  }
  emit("usage.mdx", "Usage", 2, usage);

  // 3. About — component-specific topics, then its slice of each shared guide.
  const about = merge(cfg.about, { demote: true });
  for (const guide of SHARED_GUIDES) {
    const raw = read(guide.file);
    if (!raw) continue;
    const slice = extractTab(raw, cfg.tab);
    if (!slice.trim()) continue;
    about.body += `\n\n## ${guide.title}\n\n${slice.replace(/^##\s/gm, "### ")}`;
    about.imports = [...new Set([...about.imports, ...importsOf(split(raw).body)])];
  }
  emit("about.mdx", "About", 3, about);

  // 4. Migrating — the guides that land on this component.
  emit("migrating.mdx", "Migrating", 4, merge(cfg.migrating, { demote: true }));

  console.log(`${cfg.label}: introduction, usage, about, migrating`);
}

// Remove what has been folded in. The API directory is generated and stays.
const consumed = [
  ...Object.values(COMPONENTS).flatMap((c) => [
    c.overview,
    ...c.introduction,
    ...c.usage,
    ...c.about,
    ...c.migrating,
  ]),
  ...SHARED_GUIDES.map((g) => g.file),
];
for (const rel of consumed) {
  const p = resolve(rel);
  if (p) rmSync(p);
}
rmSync(join(DOCS, "migrating"), { recursive: true, force: true });
rmSync(join(DOCS, "guides"), { recursive: true, force: true });

console.log(`\nwrote ${written} pages, removed ${consumed.length} source pages`);

// --- Rewrite links to the pages that just moved --------------------------
// Every cross-reference in the corpus points at the old per-component page set.
// They are remapped to the section each page was folded into; guide links
// resolve to the About page of whichever component the linking file belongs to.
const SECTION_OF = {};
for (const [name, cfg] of Object.entries(COMPONENTS)) {
  const put = (list, section) =>
    list.forEach((rel) => {
      const slug = rel.replace(/^.*\//, "").replace(/\.mdx?$/, "");
      SECTION_OF[`/components/${name}/${slug}`] = `/components/${name}/${section}`;
    });
  put(cfg.introduction, "introduction");
  put(cfg.usage, "usage");
  put(cfg.about, "about");
  cfg.migrating.forEach((rel) => {
    const slug = rel.replace(/^.*\//, "").replace(/\.mdx?$/, "");
    SECTION_OF[`/migrating/${slug}`] = `/components/${name}/migrating`;
  });
  // The component overview used to live at a short slug of its own.
  SECTION_OF[`/${name}`] = `/components/${name}/introduction`;
}

const GUIDE_PAGES = ["/guides/accessibility", "/guides/styling", "/guides/form-libraries"];

let rewritten = 0;
for (const file of walkDocs(DOCS)) {
  if (file.includes("/api/")) continue;
  const owner = /components\/(currency|rating|otp)\//.exec(file)?.[1];
  let text = readFileSync(file, "utf8");
  const before = text;

  for (const [from, to] of Object.entries(SECTION_OF)) {
    text = text.split(`(${from})`).join(`(${to})`);
    text = text.split(`(${from}#`).join(`(${to}#`);
  }
  // Guide links resolve to the About page of the component the file belongs to.
  // Files outside a component (getting-started, the landing) referenced the
  // guides generically; with those split three ways there is no single right
  // target, so they point at Currency's copy — worth a human pass.
  const guideOwner = owner ?? "currency";
  for (const guide of GUIDE_PAGES) {
    text = text.split(`(${guide})`).join(`(/components/${guideOwner}/about)`);
    text = text.split(`(${guide}#`).join(`(/components/${guideOwner}/about#`);
  }
  if (text !== before) {
    writeFileSync(file, text);
    rewritten++;
  }
}
console.log(`rewrote links in ${rewritten} files`);
