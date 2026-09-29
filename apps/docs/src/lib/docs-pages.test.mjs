// Route derivation and sectioning. Both fail silently when wrong — a `.md` at the
// wrong path is a 404 nobody clicks, and a mis-sectioned page lands under the
// wrong llms.txt heading while the file still looks complete.

import { describe, it } from 'vitest'
import assert from 'node:assert/strict'

import { mdRoute, htmlRoute, sectionOf, firstSentence, renderMarkdown } from './docs-pages.mjs'

/** As componentPackages() returns them. */
const COMPONENTS = [
  { slug: 'currency', label: 'Currency' },
  { slug: 'otp', label: 'OTP' },
  { slug: 'rating', label: 'Rating' },
]

describe('mdRoute / htmlRoute', () => {
  it('names the home page rather than emitting /.md', () => {
    assert.equal(mdRoute(''), '/index.md')
    assert.equal(htmlRoute(''), '/')
  })

  // The twin is a sibling FILE of the route DIRECTORY, which is what keeps
  // components/otp/api.md from colliding with components/otp/api/.
  it('puts the twin beside the route directory', () => {
    assert.equal(mdRoute('components/otp/usage'), '/components/otp/usage.md')
    assert.equal(htmlRoute('components/otp/usage'), '/components/otp/usage/')
    assert.equal(mdRoute('components/otp/api'), '/components/otp/api.md')
  })
})

describe('sectionOf', () => {
  it('groups a component page under its own slug', () => {
    assert.equal(sectionOf('components/otp/usage', COMPONENTS), 'otp')
    assert.equal(sectionOf('components/currency/introduction', COMPONENTS), 'currency')
  })

  // Generated reference belongs under llms.txt's "Optional" heading, not mixed
  // in with the prose an agent should read first.
  it('separates generated reference from prose', () => {
    assert.equal(sectionOf('components/otp/api', COMPONENTS), 'api:otp')
    assert.equal(sectionOf('components/otp/api/interfaces/otpinputprops', COMPONENTS), 'api:otp')
  })

  it('does not mistake a page merely starting with "api" for reference', () => {
    assert.equal(sectionOf('components/otp/apidesign', COMPONENTS), 'otp')
  })

  it('handles the pages that belong to no component', () => {
    assert.equal(sectionOf('index', COMPONENTS), 'root')
    assert.equal(sectionOf('overview', COMPONENTS), 'root')
    assert.equal(sectionOf('getting-started/installation', COMPONENTS), 'getting-started')
    assert.equal(sectionOf('guides/whatever', COMPONENTS), 'other')
  })

  // The guarantee that a fourth component needs no edit in this file.
  it('sections a component it has never heard of, from the manifest list alone', () => {
    const withNew = [...COMPONENTS, { slug: 'colour', label: 'Colour' }]
    assert.equal(sectionOf('components/colour/usage', withNew), 'colour')
    assert.equal(sectionOf('components/colour/api', withNew), 'api:colour')
  })
})

describe('firstSentence', () => {
  // The regression: overview.mdx opens "**The tricky React inputs, done right.**"
  // With the emphasis markers still in, the period is followed by `*` rather than
  // whitespace, no sentence matches, and the page silently loses its description.
  it('finds the sentence through emphasis markers', () => {
    assert.equal(
      firstSentence('**The tricky React inputs, done right.** Headless and accessible.'),
      'The tricky React inputs, done right.',
    )
  })

  it('skips headings, fences and JSX, which do not summarise a page', () => {
    const body = [
      '# Title',
      '```tsx',
      'const a = 1',
      '```',
      '<div>',
      'The real summary lives here.',
    ].join('\n')
    assert.equal(firstSentence(body), 'The real summary lives here.')
  })

  it('gives up rather than inventing one', () => {
    assert.equal(firstSentence('# Only a heading'), undefined)
    assert.equal(firstSentence('too short.'), undefined)
  })
})

describe('renderMarkdown', () => {
  const page = {
    title: 'Usage',
    description: 'How to use it.',
    htmlUrl: 'https://rxova.dev/packages/react-inputs/components/otp/usage/',
    body: 'Body text.',
  }

  // Starlight pages carry the title in frontmatter and no H1 in the body, so a
  // passthrough twin would arrive untitled.
  it('gives the document the H1 its body does not have', () => {
    assert.match(renderMarkdown(page), /^# Usage$/m)
  })

  it('cites the human page it came from', () => {
    assert.match(renderMarkdown(page), /^source: https:\/\/rxova\.dev\/.*\/usage\/$/m)
  })

  it('quotes frontmatter values, so a colon in a title cannot break the YAML', () => {
    const out = renderMarkdown({ ...page, title: 'Usage: the tricky bits' })
    assert.match(out, /^title: "Usage: the tricky bits"$/m)
  })

  it('omits description entirely rather than emitting an empty key', () => {
    const out = renderMarkdown({ ...page, description: undefined })
    assert.doesNotMatch(out, /^description:/m)
  })
})
