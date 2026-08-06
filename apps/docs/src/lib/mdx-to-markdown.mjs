// Turn a docs page's MDX source into plain markdown, for the `.md` twin every
// page is served at (see src/pages/[...slug].md.ts).
//
// ## Why normalize the source rather than render and convert back
//
// Rendering to HTML and converting back would need a new dependency, and it would
// reformat every code fence on the way through — and the fences are the single
// thing an agent reading these pages actually wants verbatim. The body already is
// markdown for almost all of its bytes. What is left is a closed set of MDX
// constructs, listed in the rules below; `scripts/check-md-routes.mjs` fails the
// build if a page grows one this file does not handle, so the set cannot quietly
// drift.
//
// ## The rule that matters
//
// Almost every `import` line in this content sits INSIDE a code fence — they are
// the illustrative snippets the docs are made of. Only seven are real MDX imports.
// So no rule may be applied blindly across the document: everything runs through
// `mapUnfenced`, and a fence's contents are never touched. Getting this wrong
// silently guts the examples, which is exactly the failure an agent would not
// notice and would then repeat.

import { withBase } from './base-url.mjs'

/** Opening or closing fence: ``` or ~~~, three or more, optionally indented. */
const FENCE = /^(\s*)(`{3,}|~{3,})(.*)$/

/**
 * Split into fenced and unfenced runs and apply `fn` to the unfenced ones only.
 *
 * `onFenceOpen` sees each opening fence line, so a caller can rewrite the info
 * string (which is not fence content, and is where the ```tsx live meta lives).
 */
export function mapUnfenced(text, fn, onFenceOpen = (line) => line) {
  const out = []
  let buffer = []
  let marker = null

  const flush = () => {
    if (buffer.length > 0) out.push(fn(buffer.join('\n')))
    buffer = []
  }

  for (const line of text.split('\n')) {
    const match = FENCE.exec(line)

    if (marker === null) {
      if (match) {
        flush()
        marker = match[2]
        out.push(onFenceOpen(line))
      } else {
        buffer.push(line)
      }
      continue
    }

    out.push(line)
    // A closing fence is the same character, at least as long, and carries no
    // info string. Anything else is content that merely looks like a fence.
    if (
      match &&
      match[2][0] === marker[0] &&
      match[2].length >= marker.length &&
      !match[3].trim()
    ) {
      marker = null
    }
  }

  flush()
  return out.join('\n')
}

/**
 * The document split into what a rule may look at.
 *
 * `scripts/check-md-routes.mjs` needs the same fence-awareness this module has:
 * scanning a whole `.md` for a root-relative `src="/…"` flags every snippet that
 * legitimately contains one. Sharing the split means the checker and the
 * normalizer can never disagree about where a fence begins.
 */
export function splitFenced(text) {
  const unfenced = []
  const openers = []
  mapUnfenced(
    text,
    (chunk) => {
      unfenced.push(chunk)
      return chunk
    },
    (line) => {
      openers.push(line)
      return line
    },
  )
  return { unfenced: unfenced.join('\n'), openers }
}

/** `` ```tsx live `` marks an editable example in the site. It is not a language. */
export function stripLiveMeta(fenceLine) {
  return fenceLine.replace(/^(\s*(?:`{3,}|~{3,})\s*[\w-]*)\s+live\b\s*$/, '$1')
}

/** Real MDX imports. Only ever called on unfenced text — see the header. */
export function stripImports(text) {
  return text.replace(/^import[ \t][^\n]*\n?/gm, '')
}

/**
 * Starlight's layout components, which carry no information a reader loses.
 *
 * `<TabItem label="npm">` and `<Card title="Headless">` DO carry a label, so they
 * become headings rather than vanishing — otherwise four install snippets in a
 * Tabs block arrive as four unlabelled fences and the reader cannot tell npm from
 * yarn, which is the one thing that block exists to say.
 */
export function unwrapStarlightComponents(text) {
  return text
    .replace(/^[ \t]*<TabItem\b[^>]*\blabel="([^"]*)"[^>]*>[ \t]*$/gm, '#### $1\n')
    .replace(/^[ \t]*<Card\b[^>]*\btitle="([^"]*)"[^>]*>[ \t]*$/gm, '### $1\n')
    .replace(/^[ \t]*<\/?(?:Tabs|TabItem|CardGrid|Card)\b[^>]*>[ \t]*$/gm, '')
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
      '```tsx\n' + code.replace(/\\`/g, '`').replace(/\\\$\{/g, '${') + '\n```',
  )
}

/** `<IntegrationRecipes slug="otp" />` into the exact compiled recipe sources. */
export function expandIntegrationRecipes(text, loadRecipes = () => []) {
  return text.replace(/^[ \t]*<IntegrationRecipes\s+slug="([^"]+)"\s*\/>[ \t]*$/gm, (_, slug) =>
    loadRecipes(slug)
      .map(
        ({ label, href, source }) =>
          `### [${label}](${href})\n\n\`\`\`tsx\n${source.trim()}\n\`\`\``,
      )
      .join('\n\n'),
  )
}

export function expandManualAccessibilityMatrix(text, matrix = '') {
  return text.replace(/^[ \t]*<ManualAccessibilityMatrix\s*\/>[ \t]*$/gm, matrix)
}

export function expandFrameworkCompatibilityMatrix(text, matrix = '') {
  return text.replace(/^[ \t]*<FrameworkCompatibilityMatrix\s*\/>[ \t]*$/gm, matrix)
}

/**
 * Site-root URLs into absolute ones.
 *
 * A `.md` twin gets read detached from the site — pasted into a prompt, fetched on
 * its own — so a root-relative link is not merely inconvenient, it is unresolvable.
 * Composes `withBase` rather than concatenating, so the aggregator's mount prefix
 * is applied by the same idempotent function every other link on the site uses.
 */
export function absolutizeUrls(text, { origin, base }) {
  const url = (pathname) => `${origin}${withBase(pathname, base)}`

  return (
    text
      // Markdown links and images: [x](/path), ![x](/path)
      .replace(/(\]\()(\/(?!\/)[^)\s]*)/g, (_, open, path) => open + url(path))
      // Raw HTML attributes, which overview.mdx uses throughout its suite table.
      .replace(/\b(href|src)="(\/(?!\/)[^"]*)"/g, (_, attr, path) => `${attr}="${url(path)}"`)
      // JSX expression attributes built on Astro's BASE_URL, which is how a page
      // referenced an asset without hardcoding the mount. BASE_URL has a trailing
      // slash, so what follows it is relative.
      .replace(
        /\b(href|src)=\{`\$\{import\.meta\.env\.BASE_URL\}([^`]*)`\}/g,
        (_, attr, rest) => `${attr}="${url(`/${rest}`)}"`,
      )
  )
}

/**
 * The whole pipeline. `origin` and `base` come from Astro (`import.meta.env.SITE`
 * and `BASE_URL`), so a build for the aggregator and a build for a preview each
 * emit links to themselves.
 */
export function mdxToMarkdown(
  source,
  {
    origin,
    base = '/',
    recipesFor = () => [],
    manualA11yMatrix = '',
    frameworkCompatibilityMatrix = '',
  },
) {
  const withRecipes = mapUnfenced(source, (chunk) => expandIntegrationRecipes(chunk, recipesFor))
  const withA11y = mapUnfenced(withRecipes, (chunk) =>
    expandManualAccessibilityMatrix(chunk, manualA11yMatrix),
  )
  const withFrameworks = mapUnfenced(withA11y, (chunk) =>
    expandFrameworkCompatibilityMatrix(chunk, frameworkCompatibilityMatrix),
  )
  const expanded = mapUnfenced(withFrameworks, expandLiveExamples)

  return (
    mapUnfenced(
      expanded,
      (chunk) => absolutizeUrls(unwrapStarlightComponents(stripImports(chunk)), { origin, base }),
      stripLiveMeta,
    )
      // Unwrapping components and stripping imports both leave blank lines behind.
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  )
}
