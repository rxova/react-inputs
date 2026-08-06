// The llms.txt pair: https://llmstxt.org
//
// `llms.txt` is an index — headings and links, small enough that fetching it
// costs nothing and an agent can decide what else to read. `llms-full.txt` is
// every page inlined, for the case where one fetch should be the whole thing.
//
// Both are built from `docsPages()`, the same enumeration the `.md` twins use, so
// the three surfaces cannot disagree about what pages exist. Everything here is
// pure — the endpoints in src/pages are three-line adapters — because the shape
// of these documents is the part worth testing, and it needs no Astro to check.

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
  'Headless, accessible, zero-dependency React input components: locale-aware',
  'currency, fractional ratings, one-time codes, passwords, international phone',
  'numbers, segmented date and time fields, tags and files. One native <input>',
  'where it matters, so paste, autofill, IME and native form submission come from',
  'the platform. No stylesheet to import — styling is CSS custom properties named',
  '--rx-<component>-* and data-rx-<component>-* attributes, plus unprefixed state',
  'hooks (data-invalid, data-disabled, data-readonly, data-focused) shared across',
  'the suite. Each onChange emits a plain value, never an event. React >= 18 is',
  'the only peer dependency.',
]

/** Sections in reading order. Anything not named here is appended before Optional. */
const LEAD_SECTIONS = [
  ['root', 'About'],
  ['getting-started', 'Getting started'],
]

/**
 * One entry. The description is what makes the index worth fetching: a bare list
 * of forty links tells an agent nothing about which one answers its question.
 */
const link = (page, note) => `- [${page.title}](${page.mdUrl})${note ? `: ${note}` : ''}`

/**
 * Group pages by section, in the order a reader should meet them: the framing
 * pages, then getting started, then one heading per component, then the generated
 * reference.
 *
 * `components` is the manifest-derived list, so a fourth component gets its own
 * heading — with its real title and npm name — without an edit here.
 */
export function groupPages(pages, components) {
  const bySection = new Map()
  for (const page of pages) {
    if (!bySection.has(page.section)) bySection.set(page.section, [])
    bySection.get(page.section).push(page)
  }

  const groups = []
  const take = (key, heading) => {
    const found = bySection.get(key)
    if (found?.length) groups.push({ heading, pages: found })
    bySection.delete(key)
  }

  for (const [key, heading] of LEAD_SECTIONS) take(key, heading)

  // The npm name belongs in the heading: it is what an agent has to install, and
  // one heading per component is where it will look for it.
  for (const { slug, title, label, name } of components) {
    take(slug, name ? `${title ?? label ?? slug} (${name})` : (title ?? label ?? slug))
  }

  // Anything the component list did not claim, before the optional pile.
  for (const key of [...bySection.keys()].filter((k) => !k.startsWith('api:')).sort()) {
    take(key, key)
  }

  const optional = [...bySection.keys()].sort().flatMap((key) => bySection.get(key))
  return { groups, optional }
}

/**
 * The index.
 *
 * Links point at the `.md` twins rather than the HTML pages. An agent following a
 * link from here wants the content, not the chrome — and sending it to HTML when a
 * markdown twin exists wastes the fetch this file exists to save.
 */
export function llmsIndex(pages, components, origin) {
  const { groups, optional } = groupPages(pages, components)
  const registryNames = components.map(({ slug }) => `${slug}-field`)

  const lines = [
    '# Rxova React Inputs',
    '',
    ...SUMMARY.map((l) => `> ${l}`),
    '',
    'Every link below is raw markdown. The human page is the same URL without the',
    '`.md` suffix. `llms-full.txt` beside this file inlines all of it in one fetch.',
    '',
    '## Install',
    '',
    'Either install the package and import it:',
    '',
    '    npm install @rxova/react-inputs',
    "    import { CurrencyInput, Rating, OtpInput } from '@rxova/react-inputs'",
    '',
    'That meta-package re-exports all three components, and is what every example',
    'below imports from. The individual packages —',
    '`@rxova/react-intl-currency-input`, `@rxova/react-rating-input`,',
    '`@rxova/react-otp-input` — are published separately and are equivalent, but',
    'importing from one of those names requires installing that package too.',
    '',
    'Every input is controlled and emits its **value** through `onChange`, never a',
    'DOM event: `number | null` (plus a `meta` object) for currency, `number` for',
    'rating, `string` for OTP.',
    '',
    'or copy a pre-wired field component in, with `shadcn`:',
    '',
    `    npx shadcn@latest add ${origin}/r/otp-field.json`,
    '',
    `Registry index: ${origin}/r/registry.json — ${registryNames.join(', ')}.`,
    'Each item copies a label/description/error wrapper plus a stylesheet into',
    'your project and keeps the component itself as a versioned npm dependency.',
    '',
  ]

  for (const { heading, pages: group } of groups) {
    lines.push(`## ${heading}`, '')
    for (const page of group) lines.push(link(page, page.description))
    lines.push('')
  }

  if (optional.length > 0) {
    // llmstxt.org's designated "drop this if you are short on context" section.
    // Generated reference is exactly that: precise, bulky, and not needed until
    // an agent is writing the call.
    lines.push('## Optional', '')
    lines.push('Generated TypeScript reference — exact prop types, defaults and return shapes.', '')
    // No per-entry note here: a TypeDoc page's description repeats its title
    // ("The props for OtpInput"), so it would double the section's size and add
    // nothing. The one line above says what the whole section is.
    for (const page of optional) lines.push(link(page))
    lines.push('')
  }

  return lines.join('\n')
}

/** Everything inlined, in the same order the index lists it. */
export function llmsFull(pages, components) {
  const { groups, optional } = groupPages(pages, components)
  const ordered = [...groups.flatMap((g) => g.pages), ...optional]

  const head = ['# Rxova React Inputs', '', ...SUMMARY.map((l) => `> ${l}`), ''].join('\n')

  return [
    head,
    ...ordered.map((page) =>
      [`---`, '', `# ${page.title}`, '', `Source: ${page.htmlUrl}`, '', page.body, ''].join('\n'),
    ),
  ].join('\n')
}
