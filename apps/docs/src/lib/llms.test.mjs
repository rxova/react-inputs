// llms.txt is the file an agent fetches first, so what it gets wrong it gets
// wrong before reading anything else. The two failure modes worth pinning: a
// section that silently loses its pages, and links that point at the human page
// instead of the markdown twin — which would waste the exact fetch this file
// exists to save.

import { describe, it } from 'vitest'
import assert from 'node:assert/strict'

import { llmsIndex, llmsFull, groupPages } from './llms.mjs'

/** As componentPackages() returns them. */
const COMPONENTS = [
  {
    slug: 'currency',
    label: 'Currency',
    title: 'Currency input',
    name: '@rxova/react-intl-currency-input',
  },
  { slug: 'otp', label: 'OTP', title: 'OTP input', name: '@rxova/react-otp-input' },
]

const page = (id, section, over = {}) => ({
  id,
  section,
  title: id,
  description: `About ${id}.`,
  mdUrl: `https://rxova.org/packages/react-inputs/${id}.md`,
  htmlUrl: `https://rxova.org/packages/react-inputs/${id}/`,
  body: `Body of ${id}.`,
  ...over,
})

const PAGES = [
  page('overview', 'root'),
  page('getting-started/installation', 'getting-started'),
  page('components/currency/usage', 'currency'),
  page('components/otp/usage', 'otp'),
  page('components/otp/api/interfaces/otpinputprops', 'api:otp', { title: 'OtpInputProps' }),
]

const MOUNT = 'https://rxova.org/packages/react-inputs'
const headings = (doc) => [...doc.matchAll(/^## (.+)$/gm)].map((m) => m[1])
const links = (doc) => [...doc.matchAll(/^- \[([^\]]*)\]\(([^)]*)\)(?:: (.*))?$/gm)]

describe('groupPages', () => {
  it('orders sections the way a reader should meet them', () => {
    const { groups } = groupPages(PAGES, COMPONENTS)
    assert.deepEqual(
      groups.map((g) => g.heading),
      [
        'About',
        'Getting started',
        'Currency input (@rxova/react-intl-currency-input)',
        'OTP input (@rxova/react-otp-input)',
      ],
    )
  })

  it('separates generated reference into the optional pile', () => {
    const { optional } = groupPages(PAGES, COMPONENTS)
    assert.deepEqual(
      optional.map((p) => p.id),
      ['components/otp/api/interfaces/otpinputprops'],
    )
  })

  it('omits a component heading that has no pages rather than printing it empty', () => {
    const { groups } = groupPages([page('components/otp/usage', 'otp')], COMPONENTS)
    assert.deepEqual(
      groups.map((g) => g.heading),
      ['OTP input (@rxova/react-otp-input)'],
    )
  })

  // The guarantee that a fourth component needs no edit in this file.
  it('gives a component it has never heard of its own heading, from the manifest', () => {
    const withNew = [
      ...COMPONENTS,
      { slug: 'colour', title: 'Colour input', name: '@rxova/react-colour-input' },
    ]
    const { groups } = groupPages([page('components/colour/usage', 'colour')], withNew)
    assert.deepEqual(
      groups.map((g) => g.heading),
      ['Colour input (@rxova/react-colour-input)'],
    )
  })

  // Losing a page silently is the worst outcome: the file still looks complete.
  it('keeps a page whose section no component claims', () => {
    const { groups } = groupPages([page('guides/thing', 'other')], COMPONENTS)
    assert.equal(groups.length, 1)
    assert.deepEqual(
      groups[0].pages.map((p) => p.id),
      ['guides/thing'],
    )
  })
})

describe('llmsIndex', () => {
  it('opens with the H1 and blockquote llmstxt.org specifies', () => {
    const lines = llmsIndex(PAGES, COMPONENTS, MOUNT).split('\n')
    assert.equal(lines[0], '# Rxova React Inputs')
    assert.equal(lines[1], '')
    assert.match(lines[2], /^> /)
  })

  // Sending an agent to HTML when a markdown twin exists wastes the fetch.
  it('links every entry to the markdown twin, not the human page', () => {
    for (const [, , url] of links(llmsIndex(PAGES, COMPONENTS, MOUNT))) {
      assert.match(url, /\.md$/)
      assert.match(url, /^https:\/\/rxova\.org\//)
    }
  })

  it('carries a description, so the index says which page answers what', () => {
    const [, , , note] = links(llmsIndex(PAGES, COMPONENTS, MOUNT))[0]
    assert.equal(note, 'About overview.')
  })

  // A TypeDoc page's description restates its title, so it doubles the section
  // for nothing; the one line above the list already says what they all are.
  it('does not repeat a description for every generated reference page', () => {
    const optional = llmsIndex(PAGES, COMPONENTS, MOUNT).split('## Optional')[1]
    assert.match(optional, /^- \[OtpInputProps\]\(\S+\)$/m)
  })

  it('lists every page exactly once', () => {
    const urls = links(llmsIndex(PAGES, COMPONENTS, MOUNT)).map((m) => m[2])
    assert.equal(urls.length, PAGES.length)
    assert.equal(new Set(urls).size, PAGES.length)
  })

  it('omits the Optional section entirely when there is no generated reference', () => {
    const doc = llmsIndex([page('overview', 'root')], COMPONENTS, MOUNT)
    assert.deepEqual(headings(doc), ['Install', 'About'])
  })

  // An install path an agent cannot discover is worth nothing, and `shadcn add`
  // is the verb it will reach for first in a React project.
  it('gives both install paths, with registry URLs under the mount', () => {
    const doc = llmsIndex(PAGES, COMPONENTS, MOUNT)

    assert.match(doc, /npm install @rxova\/react-inputs/)
    assert.match(
      doc,
      /npx shadcn@latest add https:\/\/rxova\.org\/packages\/react-inputs\/r\/otp-field\.json/,
    )
    assert.match(doc, /https:\/\/rxova\.org\/packages\/react-inputs\/r\/registry\.json/)
    assert.match(doc, /currency-field/)
    assert.match(doc, /otp-field/)
  })
})

describe('llmsFull', () => {
  it('inlines every page body in the order the index lists them', () => {
    const doc = llmsFull(PAGES, COMPONENTS)
    for (const p of PAGES) assert.match(doc, new RegExp(`Body of ${p.id.replace(/\//g, '\\/')}\\.`))

    // Prose before generated reference, same as the index.
    assert.ok(doc.indexOf('Body of overview.') < doc.indexOf('Body of components/otp/api'))
  })

  it('cites the human page each section came from', () => {
    assert.match(llmsFull(PAGES, COMPONENTS), /^Source: https:\/\/rxova\.org\/\S+\/$/m)
  })

  it('separates pages so one body cannot read as a continuation of the last', () => {
    const doc = llmsFull(PAGES, COMPONENTS)
    assert.equal(doc.match(/^---$/gm)?.length, PAGES.length)
  })
})
