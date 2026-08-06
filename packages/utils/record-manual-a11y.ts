import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

import { componentPackages } from './component-packages.mjs'
import {
  componentSourceHash,
  MANUAL_A11Y_SCENARIO_VERSION,
  manualA11yRecordPath,
  type ManualA11yCombination,
  type ManualA11yRecord,
  type ManualA11yResult,
} from './manual-a11y'

interface Versions {
  readonly osVersion: string
  readonly browserVersion: string
  readonly assistiveTechnologyVersion: string
}

export function parseVersions(value: string): Versions {
  const [osVersion, browserVersion, assistiveTechnologyVersion, ...extra] = value
    .split('/')
    .map((part) => part.trim())
  if (!osVersion || !browserVersion || !assistiveTechnologyVersion || extra.length > 0) {
    throw new Error('expected "OS version / browser version / assistive-technology version"')
  }
  return { osVersion, browserVersion, assistiveTechnologyVersion }
}

export function passingResult(
  combination: ManualA11yCombination,
  tester: string,
  testedAt: string,
  versions: Versions,
): ManualA11yResult {
  return { combination, status: 'pass', tester, testedAt, ...versions, notes: '' }
}

export function buildPassingRecord(options: {
  readonly repoRoot: string
  readonly slug: string
  readonly tester: string
  readonly testedAt: string
  readonly versions: Readonly<Record<ManualA11yCombination, Versions>>
}): ManualA11yRecord {
  const component = componentPackages(options.repoRoot).find(({ slug }) => slug === options.slug)
  if (!component) throw new Error(`unknown component ${options.slug}`)
  return {
    component: options.slug,
    scenarioVersion: MANUAL_A11Y_SCENARIO_VERSION,
    sourceHash: componentSourceHash(options.repoRoot, component.dir),
    results: (Object.entries(options.versions) as [ManualA11yCombination, Versions][]).map(
      ([combination, versions]) =>
        passingResult(combination, options.tester, options.testedAt, versions),
    ),
  }
}

function option(name: string): string {
  const index = process.argv.indexOf(`--${name}`)
  const value = index === -1 ? undefined : process.argv[index + 1]
  if (!value) throw new Error(`missing --${name}`)
  return value
}

const isEntrypoint =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href

if (isEntrypoint) {
  try {
    const repoRoot = resolve(process.cwd())
    const slug = option('package')
    const record = buildPassingRecord({
      repoRoot,
      slug,
      tester: option('tester'),
      testedAt: new Date().toISOString().slice(0, 10),
      versions: {
        'voiceover-safari': parseVersions(option('voiceover-safari')),
        'nvda-chrome': parseVersions(option('nvda-chrome')),
        'nvda-firefox': parseVersions(option('nvda-firefox')),
      },
    })
    const path = manualA11yRecordPath(repoRoot, slug)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, `${JSON.stringify(record, null, 2)}\n`)
    console.log(`✔ recorded passing manual accessibility evidence for ${slug}`)
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  }
}
