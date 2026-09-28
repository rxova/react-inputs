/**
 * PR gate: a change to anything a published package ships needs a changeset,
 * or it reaches npm with an unchanged version and an empty changelog.
 *
 * Stricter than `rxova-repo-config check-changeset`, which only asks when a
 * package's *code* changes. Here each package's README.md and llms.txt ship in
 * its tarball — the llms.txt is what a coding agent reads out of node_modules —
 * so a doc change is a release like any other. What ships is read from each
 * published package's manifest (see is-shipped-path.ts); tests, e2e specs,
 * demos and anything outside a published package never need one.
 *
 * Run from the repository root with `BASE_SHA` and `HEAD_SHA` set; the range is
 * `base...head`. Escape hatches: the `skip-changeset` label (`PR_LABELS`,
 * comma-separated) or `[skip-changeset]` in `PR_TITLE`. Each changeset must name
 * exactly one package, so every changelog entry belongs to the package it
 * describes.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

import { isEntry } from '@rxova/repo-config'

import { gitDiff } from './git-diff'
import { packagesNamed } from './packages-named'
import { shippedChanges } from './shipped-changes'

const SKIP = 'skip-changeset'

type Diff = (base: string, head: string, options?: { existing?: boolean }) => string[]

const isChangeset = (file: string): boolean =>
  file.startsWith('.changeset/') && file.endsWith('.md') && !file.endsWith('/README.md')

/** Returns the process exit code; reports on stdout/stderr. */
export const checkChangeset = (
  env: NodeJS.ProcessEnv = process.env,
  { root = process.cwd(), diff = gitDiff }: { root?: string; diff?: Diff } = {},
): number => {
  const base = env.BASE_SHA
  const head = env.HEAD_SHA
  if (!base || !head) {
    console.error('check-changeset: BASE_SHA and HEAD_SHA must be set')
    return 1
  }

  try {
    const shipped = shippedChanges(diff(base, head), root)
    if (shipped.length === 0) {
      console.log('check-changeset: nothing a published package ships changed')
      return 0
    }

    const labels = (env.PR_LABELS ?? '').split(',').map((label) => label.trim())
    if (labels.includes(SKIP)) {
      console.log(`check-changeset: \`${SKIP}\` set on this pull request`)
      return 0
    }
    if ((env.PR_TITLE ?? '').includes(`[${SKIP}]`)) {
      console.log(`check-changeset: \`[${SKIP}]\` in the pull request title`)
      return 0
    }

    const changesets = diff(base, head, { existing: true }).filter(isChangeset)
    if (changesets.length === 0) {
      console.error(
        [
          'check-changeset: this PR changes files a published package ships, but adds no changeset:',
          ...shipped.map((file) => `  ${file}`),
          '',
          'Run `pnpm changeset` and commit the file it writes.',
          `If it publishes nothing — a dependency bump, say — label it \`${SKIP}\`.`,
        ].join('\n'),
      )
      return 1
    }

    const problems = changesets.flatMap((file) => {
      let body: string
      try {
        body = readFileSync(join(root, file), 'utf8')
      } catch {
        return [`  ${file}: could not be read`]
      }
      const count = packagesNamed(body)
      return count === 1 ? [] : [`  ${file}: names ${String(count)} packages, expected 1`]
    })
    if (problems.length > 0) {
      console.error(
        ['check-changeset: each changeset must name exactly one package.', ...problems].join('\n'),
      )
      return 1
    }

    console.log('check-changeset: changeset present')
    return 0
  } catch (failure) {
    console.error(`check-changeset failed — ${(failure as Error).message}`)
    return 1
  }
}

if (isEntry(import.meta.url)) process.exit(checkChangeset())
