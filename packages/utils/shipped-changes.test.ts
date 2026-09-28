import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { shippedChanges } from './shipped-changes'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'rxova-shipped-'))
  roots.push(root)
  for (const [dir, manifest] of Object.entries({
    input: { name: '@rxova/input', files: ['dist', 'llms.txt'] },
    kit: { name: 'kit', private: true, files: ['dist'] },
  })) {
    mkdirSync(join(root, 'packages', dir), { recursive: true })
    writeFileSync(join(root, 'packages', dir, 'package.json'), JSON.stringify(manifest))
  }
  return root
}

describe('shippedChanges', () => {
  it('keeps only paths a published package ships', () => {
    expect(
      shippedChanges(
        [
          'README.md',
          'packages',
          'packages/input/llms.txt',
          'packages/input/src/index.ts',
          'packages/input/src/index.test.ts',
          'packages/kit/src/index.ts',
          'packages/gone/src/index.ts',
        ],
        fixture(),
      ),
    ).toEqual(['packages/input/llms.txt', 'packages/input/src/index.ts'])
  })
})
