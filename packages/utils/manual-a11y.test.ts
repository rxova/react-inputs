import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  checkManualA11y,
  componentSourceHash,
  manualA11yRecordPath,
  pendingManualA11yRecord,
  type ManualA11yRecord,
} from './manual-a11y'
import { buildPassingRecord, parseVersions } from './record-manual-a11y'

let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'rxova-manual-a11y-'))
  mkdirSync(join(root, 'packages', 'react-otp-input', 'src', '__tests__'), { recursive: true })
  writeFileSync(
    join(root, 'packages', 'react-otp-input', 'package.json'),
    JSON.stringify({
      name: '@rxova/react-otp-input',
      description: 'OTP',
      rxova: { slug: 'otp', label: 'OTP' },
    }),
  )
  writeFileSync(
    join(root, 'packages', 'react-otp-input', 'src', 'index.ts'),
    'export const otp = 1\n',
  )
  writeFileSync(
    join(root, 'packages', 'react-otp-input', 'src', '__tests__', 'otp.test.ts'),
    'test()\n',
  )
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

const versions = {
  'voiceover-safari': parseVersions('macOS 15 / Safari 18 / VoiceOver 15'),
  'nvda-chrome': parseVersions('Windows 11 / Chrome 130 / NVDA 2025.1'),
  'nvda-firefox': parseVersions('Windows 11 / Firefox 132 / NVDA 2025.1'),
}

function writeRecord(record: ManualA11yRecord) {
  const path = manualA11yRecordPath(root, 'otp')
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, JSON.stringify(record))
}

describe('manual accessibility source hash', () => {
  it('changes for shippable source but ignores test-only edits', () => {
    const initial = componentSourceHash(root, 'react-otp-input')
    writeFileSync(
      join(root, 'packages', 'react-otp-input', 'src', '__tests__', 'otp.test.ts'),
      'changed test\n',
    )
    expect(componentSourceHash(root, 'react-otp-input')).toBe(initial)

    writeFileSync(
      join(root, 'packages', 'react-otp-input', 'src', 'index.ts'),
      'export const otp = 2\n',
    )
    expect(componentSourceHash(root, 'react-otp-input')).not.toBe(initial)
  })
})

describe('checkManualA11y', () => {
  it('accepts a complete passing record for current source', () => {
    writeRecord(
      buildPassingRecord({
        repoRoot: root,
        slug: 'otp',
        tester: '@tester',
        testedAt: '2026-08-05',
        versions,
      }),
    )
    expect(checkManualA11y(root)).toEqual([])
  })

  it('reports pending combinations without treating intentionally empty metadata as a second failure', () => {
    writeRecord(pendingManualA11yRecord(root, { slug: 'otp', dir: 'react-otp-input' }))
    const reasons = checkManualA11y(root).map(({ reason }) => reason)
    expect(reasons).toContain('voiceover-safari is pending')
    expect(reasons).not.toContain('nvda-firefox is missing tester, date, or version evidence')
  })

  it('invalidates a pass after runtime source changes', () => {
    writeRecord(
      buildPassingRecord({
        repoRoot: root,
        slug: 'otp',
        tester: '@tester',
        testedAt: '2026-08-05',
        versions,
      }),
    )
    writeFileSync(join(root, 'packages', 'react-otp-input', 'src', 'index.ts'), 'changed\n')
    expect(checkManualA11y(root).map(({ reason }) => reason)).toContain(
      'source changed since the recorded manual audit',
    )
  })
})

describe('recordManualA11y helpers', () => {
  it('rejects an ambiguous version string', () => {
    expect(() => parseVersions('macOS / Safari')).toThrow('expected')
  })

  it('rejects an unknown component', () => {
    expect(() =>
      buildPassingRecord({
        repoRoot: root,
        slug: 'ghost',
        tester: '@tester',
        testedAt: '2026-08-05',
        versions,
      }),
    ).toThrow('unknown component ghost')
  })
})
