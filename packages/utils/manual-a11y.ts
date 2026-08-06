/**
 * Manual assistive-technology evidence for every published component.
 *
 * Automated axe checks cannot say what VoiceOver or NVDA actually announces.
 * These helpers fingerprint the shippable source and validate version-controlled
 * human results. Any non-test source edit changes the hash and invalidates the
 * previous attestation; evidence deliberately does not expire by date.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

import { componentPackages } from './component-packages.mjs'

export const MANUAL_A11Y_SCENARIO_VERSION = 1
export const REQUIRED_MANUAL_A11Y_COMBINATIONS = [
  'voiceover-safari',
  'nvda-chrome',
  'nvda-firefox',
] as const

export type ManualA11yCombination = (typeof REQUIRED_MANUAL_A11Y_COMBINATIONS)[number]
export type ManualA11yStatus = 'pass' | 'pending' | 'fail'

export interface ManualA11yResult {
  readonly combination: ManualA11yCombination
  readonly status: ManualA11yStatus
  readonly testedAt: string | null
  readonly tester: string | null
  readonly osVersion: string | null
  readonly browserVersion: string | null
  readonly assistiveTechnologyVersion: string | null
  readonly notes?: string
}

export interface ManualA11yRecord {
  readonly component: string
  readonly scenarioVersion: number
  readonly sourceHash: string
  readonly results: readonly ManualA11yResult[]
}

const isTestSource = (path: string) =>
  path.split('/').includes('__tests__') || /\.(?:browser\.)?test\.[^.]+$/.test(path)

function sourceFiles(dir: string, base = dir): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(dir, entry.name)
      return entry.isDirectory() ? sourceFiles(path, base) : [path]
    })
    .filter((path) => !isTestSource(relative(base, path)))
    .sort()
}

export function componentSourceHash(repoRoot: string, packageDir: string): string {
  const src = join(repoRoot, 'packages', packageDir, 'src')
  const hash = createHash('sha256')
  for (const path of sourceFiles(src)) {
    hash.update(relative(src, path))
    hash.update('\0')
    hash.update(readFileSync(path))
    hash.update('\0')
  }
  return `sha256:${hash.digest('hex')}`
}

export function manualA11yRecordPath(repoRoot: string, slug: string): string {
  return join(repoRoot, 'accessibility', 'manual', `${slug}.json`)
}

export function readManualA11yRecord(path: string): ManualA11yRecord {
  return JSON.parse(readFileSync(path, 'utf8')) as ManualA11yRecord
}

export interface ManualA11yFailure {
  readonly component: string
  readonly reason: string
}

export function checkManualA11y(repoRoot: string): ManualA11yFailure[] {
  const failures: ManualA11yFailure[] = []
  for (const component of componentPackages(repoRoot)) {
    const add = (reason: string) => failures.push({ component: component.slug, reason })
    const path = manualA11yRecordPath(repoRoot, component.slug)
    if (!existsSync(path)) {
      add('has no manual accessibility record')
      continue
    }

    let record: ManualA11yRecord
    try {
      record = readManualA11yRecord(path)
    } catch {
      add('has an unreadable manual accessibility record')
      continue
    }

    if (record.component !== component.slug) add(`record names ${record.component}`)
    if (record.scenarioVersion !== MANUAL_A11Y_SCENARIO_VERSION) {
      add(`uses scenario version ${String(record.scenarioVersion)}`)
    }
    const currentHash = componentSourceHash(repoRoot, component.dir)
    if (record.sourceHash !== currentHash) add('source changed since the recorded manual audit')

    const byCombination = new Map(record.results.map((result) => [result.combination, result]))
    for (const combination of REQUIRED_MANUAL_A11Y_COMBINATIONS) {
      const result = byCombination.get(combination)
      if (!result) {
        add(`has no ${combination} result`)
        continue
      }
      if (result.status !== 'pass') add(`${combination} is ${result.status}`)
      if (
        result.status !== 'pending' &&
        (!result.testedAt ||
          !result.tester ||
          !result.osVersion ||
          !result.browserVersion ||
          !result.assistiveTechnologyVersion)
      ) {
        add(`${combination} is missing tester, date, or version evidence`)
      }
    }
    const unexpected = record.results.filter(
      ({ combination }) => !REQUIRED_MANUAL_A11Y_COMBINATIONS.includes(combination),
    )
    if (unexpected.length > 0) add(`contains unexpected combinations`)
  }
  return failures
}

export function pendingManualA11yRecord(
  repoRoot: string,
  component: { readonly slug: string; readonly dir: string },
): ManualA11yRecord {
  return {
    component: component.slug,
    scenarioVersion: MANUAL_A11Y_SCENARIO_VERSION,
    sourceHash: componentSourceHash(repoRoot, component.dir),
    results: REQUIRED_MANUAL_A11Y_COMBINATIONS.map((combination) => ({
      combination,
      status: 'pending',
      testedAt: null,
      tester: null,
      osVersion: null,
      browserVersion: null,
      assistiveTechnologyVersion: null,
      notes: '',
    })),
  }
}
