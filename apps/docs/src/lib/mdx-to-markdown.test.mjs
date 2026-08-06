// The rules are individually trivial; what is not trivial is that none of them
// may touch a code fence. Almost every `import` line in this content is inside
// one — they are the illustrative snippets the docs are made of — so a rule
// applied document-wide would gut the examples while leaving output that still
// looks like a complete page. That is what most of these tests are about.

import { describe, it } from 'vitest'
import assert from 'node:assert/strict'

import {
  expandIntegrationRecipes,
  expandFrameworkCompatibilityMatrix,
  mdxToMarkdown,
  mapUnfenced,
  stripImports,
  stripLiveMeta,
  unwrapStarlightComponents,
  expandLiveExamples,
  absolutizeUrls,
} from './mdx-to-markdown.mjs'

const SITE = { origin: 'https://rxova.org', base: '/packages/react-inputs/' }
const run = (source) => mdxToMarkdown(source, SITE)

describe('mapUnfenced', () => {
  it('applies the rule outside fences and never inside one', () => {
    const source = ['a', '```tsx', 'a', '```', 'a'].join('\n')
    assert.equal(
      mapUnfenced(source, (t) => t.replace(/a/g, 'B')),
      ['B', '```tsx', 'a', '```', 'B'].join('\n'),
    )
  })

  it('is not closed by a fence-looking line inside a longer fence', () => {
    const source = ['````md', '```', 'still inside', '````', 'out'].join('\n')
    assert.equal(
      mapUnfenced(source, () => 'X'),
      ['````md', '```', 'still inside', '````', 'X'].join('\n'),
    )
  })

  it('leaves an unterminated fence closed, rather than treating the rest as prose', () => {
    assert.equal(
      mapUnfenced(['```', 'import x', 'import y'].join('\n'), () => 'X'),
      ['```', 'import x', 'import y'].join('\n'),
    )
  })
})

describe('stripImports', () => {
  it('removes a real MDX import', () => {
    assert.equal(stripImports("import { Tabs } from '@astrojs/starlight/components'\ntext"), 'text')
  })

  it('leaves a word merely starting with import alone', () => {
    assert.equal(stripImports('important context\n'), 'important context\n')
  })
})

describe('stripLiveMeta', () => {
  it('drops the live marker, which is not a language', () => {
    assert.equal(stripLiveMeta('```tsx live'), '```tsx')
  })

  it('leaves an ordinary fence untouched', () => {
    assert.equal(stripLiveMeta('```tsx'), '```tsx')
    assert.equal(stripLiveMeta('```sh'), '```sh')
  })
})

describe('unwrapStarlightComponents', () => {
  // Four unlabelled install snippets is precisely what the Tabs block exists to
  // prevent, so the label has to survive as something.
  it('keeps the tab label as a heading', () => {
    const out = unwrapStarlightComponents(
      ['<Tabs syncKey="pm">', '<TabItem label="npm">', 'x', '</TabItem>', '</Tabs>'].join('\n'),
    )
    assert.match(out, /^#### npm$/m)
    assert.doesNotMatch(out, /<Tabs|<TabItem|<\/Tabs>/)
  })

  it('keeps the card title as a heading and drops the icon', () => {
    const out = unwrapStarlightComponents(
      '<CardGrid>\n<Card title="Headless" icon="setting">\nx\n</Card>\n</CardGrid>',
    )
    assert.match(out, /^### Headless$/m)
    assert.doesNotMatch(out, /icon=|CardGrid/)
  })
})

describe('expandLiveExamples', () => {
  it('turns the hand-written island back into the fence it was authored as', () => {
    const out = expandLiveExamples('<LiveExample\n  code={`function A() {\n  return <b />\n}`}\n/>')
    assert.equal(out, '```tsx\nfunction A() {\n  return <b />\n}\n```')
  })

  it('undoes the template-literal escaping a fence does not want', () => {
    const out = expandLiveExamples('<LiveExample code={`const a = \\`x\\${y}\\``} />')
    assert.match(out, /const a = `x\$\{y\}`/)
  })
})

describe('expandIntegrationRecipes', () => {
  it('turns the authored component into labelled copy-paste code', () => {
    const source = '<IntegrationRecipes slug="otp" />'
    const output = expandIntegrationRecipes(source, (slug) => [
      { label: 'Material UI', href: 'https://mui.com', source: `// ${slug}` },
    ])

    assert.match(output, /^### \[Material UI\]\(https:\/\/mui\.com\)$/m)
    assert.match(output, /```tsx\n\/\/ otp\n```/)
  })

  it('does not expand a component-looking line inside a fence', () => {
    const source = ['```mdx', '<IntegrationRecipes slug="otp" />', '```'].join('\n')
    assert.equal(
      mapUnfenced(source, (chunk) => expandIntegrationRecipes(chunk, () => [])),
      source,
    )
  })
})

describe('expandFrameworkCompatibilityMatrix', () => {
  it('turns the authored component into the derived proof table', () => {
    assert.equal(
      expandFrameworkCompatibilityMatrix('<FrameworkCompatibilityMatrix />', '| Vite | pass |'),
      '| Vite | pass |',
    )
  })

  it('does not expand a component-looking line inside a fence', () => {
    const source = ['```mdx', '<FrameworkCompatibilityMatrix />', '```'].join('\n')
    assert.equal(
      mapUnfenced(source, (chunk) => expandFrameworkCompatibilityMatrix(chunk, 'proof')),
      source,
    )
  })
})

describe('absolutizeUrls', () => {
  it('resolves markdown links through the mount, not by concatenation', () => {
    assert.equal(
      absolutizeUrls('[API](/components/otp/api)', SITE),
      '[API](https://rxova.org/packages/react-inputs/components/otp/api)',
    )
  })

  it('resolves the raw HTML attributes overview.mdx is built from', () => {
    assert.equal(
      absolutizeUrls('<a href="/components/rating/api">API</a>', SITE),
      '<a href="https://rxova.org/packages/react-inputs/components/rating/api">API</a>',
    )
  })

  it('resolves a BASE_URL expression attribute, which is how assets avoid hardcoding the mount', () => {
    assert.equal(
      absolutizeUrls('<img src={`${import.meta.env.BASE_URL}img/logos/otp.svg`} />', SITE),
      '<img src="https://rxova.org/packages/react-inputs/img/logos/otp.svg" />',
    )
  })

  it('leaves an already-absolute URL alone', () => {
    const external = '[gh](https://github.com/rxova/react-inputs)'
    assert.equal(absolutizeUrls(external, SITE), external)
  })

  it('leaves a relative link alone, having no page to resolve it against', () => {
    assert.equal(absolutizeUrls('[x](./usage)', SITE), '[x](./usage)')
  })
})

describe('mdxToMarkdown', () => {
  // The regression this whole module is shaped around.
  it('keeps import lines that are snippet content, and drops the ones that are MDX', () => {
    const source = [
      "import { Tabs, TabItem } from '@astrojs/starlight/components'",
      '',
      'Prose.',
      '',
      '```tsx',
      "import { OtpInput } from '@rxova/react-otp-input'",
      '',
      'export const A = () => <OtpInput length={6} />',
      '```',
    ].join('\n')

    const out = run(source)
    assert.doesNotMatch(out, /@astrojs\/starlight/)
    assert.match(out, /import \{ OtpInput \} from '@rxova\/react-otp-input'/)
  })

  it('does not rewrite a URL that is snippet content', () => {
    const out = run(['```ts', "fetch('/api/session')", '```'].join('\n'))
    assert.match(out, /fetch\('\/api\/session'\)/)
  })

  it('leaves an api reference page, which is already plain markdown, alone but for links', () => {
    const source = [
      '## OtpInputProps',
      '',
      '| Prop | Type |',
      '| --- | --- |',
      '| `length` | `number` |',
    ].join('\n')
    assert.equal(run(source), source)
  })

  it('collapses the blank lines unwrapping leaves behind', () => {
    assert.doesNotMatch(
      run('<CardGrid>\n\n<Card title="A">\n\nx\n\n</Card>\n\n</CardGrid>'),
      /\n{3}/,
    )
  })
})
