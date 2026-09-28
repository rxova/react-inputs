import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'

import { checkChangeset } from './check-changeset'

const roots: string[] = []
let errors: MockInstance<typeof console.error>

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => undefined)
  errors = vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

const write = (root: string, file: string, body: string) => {
  mkdirSync(dirname(join(root, file)), { recursive: true })
  writeFileSync(join(root, file), body)
}

/** A published `input` package, a private `utils` one, and whatever extra files a test needs. */
function fixture(extra: Record<string, string> = {}) {
  const root = mkdtempSync(join(tmpdir(), 'rxova-changeset-'))
  roots.push(root)
  write(
    root,
    'packages/input/package.json',
    JSON.stringify({ name: '@rxova/input', files: ['dist', 'llms.txt'] }),
  )
  write(root, 'packages/utils/package.json', JSON.stringify({ name: 'utils', private: true }))
  for (const [file, body] of Object.entries(extra)) write(root, file, body)
  return root
}

const one = "---\n'@rxova/input': patch\n---\n\nFix.\n"
const two = "---\n'@rxova/input': patch\n'@rxova/other': patch\n---\n\nFix both.\n"

/** Runs the check as if `changed` were the pull request's diff (deletions listed in `deleted`). */
function check(
  changed: string[],
  { root = fixture(), deleted = [] as string[], labels = '', title = '' } = {},
) {
  return checkChangeset(
    { BASE_SHA: 'base', HEAD_SHA: 'head', PR_LABELS: labels, PR_TITLE: title },
    {
      root,
      diff: (_base, _head, { existing = false } = {}) =>
        existing ? changed.filter((file) => !deleted.includes(file)) : changed,
    },
  )
}

describe('checkChangeset', () => {
  it('requires a changeset for a shipped code change', () => {
    expect(check(['packages/input/src/index.ts'])).toBe(1)
    expect(String(errors.mock.calls[0]?.[0])).toContain('packages/input/src/index.ts')
  })

  it('requires a changeset for a README or llms.txt change, since both ship', () => {
    expect(check(['packages/input/README.md'])).toBe(1)
    expect(check(['packages/input/llms.txt'])).toBe(1)
  })

  it('accepts a shipped change that comes with a changeset', () => {
    const root = fixture({ '.changeset/fix.md': one })
    expect(check(['packages/input/README.md', '.changeset/fix.md'], { root })).toBe(0)
  })

  it('needs no changeset for a test-only change', () => {
    expect(
      check([
        'packages/input/src/__tests__/input.test.ts',
        'packages/input/src/input.test.tsx',
        'packages/input/e2e/input.spec.ts',
      ]),
    ).toBe(0)
  })

  it('needs no changeset for files a package does not pack', () => {
    expect(check(['packages/input/CHANGELOG.md', 'packages/input/demo/Demo.tsx'])).toBe(0)
  })

  it('needs no changeset for a change outside published packages', () => {
    expect(
      check(['README.md', 'llms.txt', '.github/workflows/ci.yml', 'packages/utils/index.ts']),
    ).toBe(0)
  })

  it('lets the skip-changeset label or title marker excuse a shipped change', () => {
    expect(check(['packages/input/src/index.ts'], { labels: 'deps, skip-changeset' })).toBe(0)
    expect(check(['packages/input/src/index.ts'], { title: 'chore: x [skip-changeset]' })).toBe(0)
  })

  it('rejects a changeset that names more than one package', () => {
    const root = fixture({ '.changeset/both.md': two })
    expect(check(['packages/input/src/index.ts', '.changeset/both.md'], { root })).toBe(1)
    expect(String(errors.mock.calls[0]?.[0])).toContain('names 2 packages, expected 1')
  })

  it('does not count a deleted changeset as present', () => {
    expect(
      check(['packages/input/src/index.ts', '.changeset/old.md'], {
        deleted: ['.changeset/old.md'],
      }),
    ).toBe(1)
  })

  it('fails without BASE_SHA and HEAD_SHA', () => {
    expect(checkChangeset({}, { root: fixture(), diff: () => [] })).toBe(1)
  })

  it('fails closed when the diff cannot be read', () => {
    const diff = () => {
      throw new Error('bad revision')
    }
    expect(checkChangeset({ BASE_SHA: 'a', HEAD_SHA: 'b' }, { root: fixture(), diff })).toBe(1)
    expect(String(errors.mock.calls[0]?.[0])).toContain('bad revision')
  })
})
