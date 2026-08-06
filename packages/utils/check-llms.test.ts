/**
 * The rule worth testing hardest is the prop-table one, and specifically that it
 * FAILS. The first implementation used a single regex whose lookahead matched an
 * empty string immediately, so it read every Props section as empty and passed on
 * everything — a gate that cannot fail reads exactly like one that never needed
 * to, which is worse than no gate at all.
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { checkLlms, documentedProps, declaredProps, publishedPackages } from './check-llms'

const roots: string[] = []
let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'rxova-check-llms-'))
  roots.push(root)
})
afterAll(() => {
  for (const dir of roots) rmSync(dir, { recursive: true, force: true })
})

const write = (path: string, body: string): void => {
  const full = join(root, path)
  mkdirSync(join(full, '..'), { recursive: true })
  writeFileSync(full, body)
}

const LLMS = [
  '# @rxova/thing',
  '',
  '> Does a thing.',
  '',
  '## Install',
  '',
  '    npm install @rxova/thing',
  '',
  '## Props',
  '',
  '| Prop | Type | Default | Notes |',
  '| --- | --- | --- | --- |',
  '| `length` | `number` | `6` | How many. |',
  '',
  '## Docs',
  '',
  '- Introduction: https://rxova.org/packages/react-inputs/',
  '',
].join('\n')

const TYPES = ['export interface ThingProps {', '  length?: number', '}', ''].join('\n')

/** A published package with everything in place, which is the passing shape. */
function validPackage({
  llms = LLMS,
  types = TYPES,
  files = ['dist', 'llms.txt'],
  slug,
}: {
  llms?: string
  types?: string
  files?: string[]
  slug?: string
} = {}) {
  write(
    'packages/thing/package.json',
    JSON.stringify({ name: '@rxova/thing', files, rxova: slug ? { slug } : undefined }),
  )
  write('packages/thing/llms.txt', llms)
  write('packages/thing/src/types.ts', types)
}

const reasons = () => checkLlms(root).map((f) => f.reason)

describe('publishedPackages', () => {
  it('ignores a private package, which ships no tarball to read', () => {
    validPackage()
    write('packages/utils/package.json', JSON.stringify({ name: '@rxova/utils', private: true }))

    expect(publishedPackages(root).map((p) => p.name)).toEqual(['@rxova/thing'])
  })
})

describe('documentedProps', () => {
  it('reads the first column of the Props table', () => {
    expect(documentedProps(LLMS)).toEqual(['length'])
  })

  // The regression. If this returns [], every prop-drift case below passes
  // vacuously and the checker is decorative.
  it('does not stop at the heading and return nothing', () => {
    expect(documentedProps(LLMS).length).toBeGreaterThan(0)
  })

  it('stops at the next section rather than swallowing the rest of the file', () => {
    const body = `${LLMS}\n## Styling\n\n| Prop | x |\n| --- | --- |\n| \`notAProp\` | y |\n`
    expect(documentedProps(body)).toEqual(['length'])
  })

  it('skips separator and prose rows rather than reporting them', () => {
    const body = LLMS.replace('| `length` |', '| Anything at all |\n| `length` |')
    expect(documentedProps(body)).toEqual(['length'])
  })

  it('returns nothing for a package that documents no props', () => {
    expect(documentedProps('# @rxova/codemod\n\n> A CLI.\n\n## Use\n')).toEqual([])
  })
})

describe('declaredProps', () => {
  it('collects members across every exported interface', () => {
    write('types.ts', 'export interface A { one?: string }\nexport interface B { two?: number }\n')
    expect([...declaredProps(join(root, 'types.ts'))].sort()).toEqual(['one', 'two'])
  })

  it('collects a quoted member, which is how the aria props are declared', () => {
    write('types.ts', "export interface A { 'aria-describedby'?: string }\n")
    expect(declaredProps(join(root, 'types.ts')).has('aria-describedby')).toBe(true)
  })

  it('returns an empty set for a package with no types.ts', () => {
    expect(declaredProps(join(root, 'nope.ts')).size).toBe(0)
  })
})

describe('checkLlms', () => {
  it('passes a package with everything in place', () => {
    validPackage()
    expect(checkLlms(root)).toEqual([])
  })

  // The drift that actually matters: a rename in types.ts leaves the table
  // describing an API that no longer exists, and every test still passes.
  it('reports a documented prop that no longer exists', () => {
    validPackage({ types: 'export interface ThingProps {\n  size?: number\n}\n' })

    expect(reasons()).toEqual([
      'llms.txt documents `length`, which no longer exists in src/types.ts',
    ])
  })

  it('reports a missing file', () => {
    write('packages/thing/package.json', JSON.stringify({ name: '@rxova/thing', files: ['dist'] }))

    expect(reasons()).toEqual(['has no llms.txt — every published package ships one'])
  })

  // Present but unshipped is the worst of both: maintained by hand, read by
  // nobody, and nothing else would ever say so.
  it('reports a file that exists but is not published', () => {
    validPackage({ files: ['dist'] })

    expect(reasons()).toEqual([
      'llms.txt exists but is not in the `files` array, so it is not published',
    ])
  })

  // These files are near-identical in shape, so a copy-pasted sibling is the
  // likeliest way one goes wrong, and the H1 is where it shows.
  it('reports an H1 that names a different package', () => {
    validPackage({ llms: LLMS.replace('# @rxova/thing', '# @rxova/other') })

    expect(reasons()[0]).toMatch(/must open with "# @rxova\/thing"/)
  })

  it('reports a missing summary blockquote', () => {
    validPackage({ llms: LLMS.replace('> Does a thing.', 'Does a thing.') })

    expect(reasons()).toEqual(['llms.txt needs a "> " summary blockquote under the title'])
  })

  it('reports a missing Docs section', () => {
    validPackage({ llms: LLMS.replace('## Docs', '## Elsewhere') })

    expect(reasons()).toEqual(['llms.txt is missing a "## Docs" section'])
  })

  it('requires registry and recipe links for a component package', () => {
    validPackage({ slug: 'thing' })

    expect(reasons()).toEqual([
      'llms.txt is missing its copyable registry URL (/r/thing-field.json)',
      'llms.txt is missing its UI-library recipes URL (/components/thing/about/#ui-library-recipes)',
    ])
  })

  // @rxova/codemod is a CLI invoked with npx, so demanding an Install section
  // there would only produce a heading that lies.
  it('accepts "## Use" in place of "## Install"', () => {
    validPackage({ llms: LLMS.replace('## Install', '## Use') })

    expect(checkLlms(root)).toEqual([])
  })

  // A table of props it does not own would be the drift, not the fix.
  it('does not demand a props table from a package that has no props', () => {
    write('packages/cli/package.json', JSON.stringify({ name: '@rxova/cli', files: ['llms.txt'] }))
    write('packages/cli/llms.txt', '# @rxova/cli\n\n> A CLI.\n\n## Use\n\n## Docs\n')

    expect(checkLlms(root)).toEqual([])
  })

  it('reports a props table with no types.ts to check it against', () => {
    validPackage()
    rmSync(join(root, 'packages/thing/src/types.ts'))

    expect(reasons()).toEqual([
      'llms.txt documents props but src/types.ts declares none to check against',
    ])
  })
})
