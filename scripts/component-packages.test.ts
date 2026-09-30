import { existsSync, readdirSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { componentPackages, REPO_ROOT } from './component-packages.mjs'

/**
 * The registry every matrix, sidebar and alias now reads. Its failure mode is
 * silence: a package that does not get discovered is not reported anywhere, it
 * simply stops being tested, documented and demoed — which is the exact failure
 * the central lists it replaces used to have.
 */

const tempRoots: string[] = []

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

const writePackage = async (root: string, dir: string, manifest: Record<string, unknown>) => {
  await mkdir(join(root, 'packages', dir), { recursive: true })
  await writeFile(
    join(root, 'packages', dir, 'package.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  )
}

const fixture = async (packages: Record<string, Record<string, unknown>>) => {
  const root = await mkdtemp(join(tmpdir(), 'component-packages-'))
  tempRoots.push(root)
  await mkdir(join(root, 'packages'), { recursive: true })

  for (const [dir, manifest] of Object.entries(packages)) {
    await writePackage(root, dir, manifest)
  }

  return root
}

const component = (slug: string, extra: Record<string, unknown> = {}) => ({
  name: `@rxova/react-${slug}-input`,
  rxova: { slug, label: slug.toUpperCase(), title: `${slug} input`, ...extra },
})

describe('componentPackages', () => {
  it('discovers the packages that declare themselves', async () => {
    const root = await fixture({ 'react-otp-input': component('otp') })

    expect(componentPackages(root)).toEqual([
      {
        dir: 'react-otp-input',
        name: '@rxova/react-otp-input',
        slug: 'otp',
        label: 'OTP',
        title: 'otp input',
        description: 'otp input',
      },
    ])
  })

  it('ignores packages with no rxova block', async () => {
    const root = await fixture({
      'react-otp-input': component('otp'),
      // The meta-package, the codemod and the private tooling all live in
      // packages/ and none of them is a component.
      'react-inputs': { name: '@rxova/react-inputs' },
      codemod: { name: '@rxova/codemod' },
      utils: { name: '@rxova/utils', private: true },
    })

    expect(componentPackages(root).map((pkg) => pkg.dir)).toEqual(['react-otp-input'])
  })

  it('ignores an rxova block with no slug, which is not a component declaration', async () => {
    const root = await fixture({ brand: { name: '@rxova/brand', rxova: { label: 'Brand' } } })

    expect(componentPackages(root)).toEqual([])
  })

  it('sorts alphabetically by label, regardless of directory read order', async () => {
    const root = await fixture({
      'react-otp-input': component('otp'),
      'react-currency-input': component('currency'),
      'react-rating-input': component('rating'),
    })

    // Labels are the slugs upper-cased here (see `component`), so the order is
    // CURRENCY, OTP, RATING — derived from what is displayed, not a declaration.
    expect(componentPackages(root).map((pkg) => pkg.slug)).toEqual(['currency', 'otp', 'rating'])
  })

  it('sorts case-insensitively by label, so the list stays stable', async () => {
    const root = await fixture({
      'react-zebra-input': { name: '@rxova/x', rxova: { slug: 'zebra', label: 'zebra' } },
      'react-alpha-input': { name: '@rxova/y', rxova: { slug: 'alpha', label: 'Alpha' } },
      'react-otp-input': { name: '@rxova/z', rxova: { slug: 'otp', label: 'omega' } },
    })

    expect(componentPackages(root).map((pkg) => pkg.slug)).toEqual(['alpha', 'otp', 'zebra'])
  })

  it('falls back to the slug when label and title are absent', async () => {
    const root = await fixture({ 'react-otp-input': { name: '@rxova/x', rxova: { slug: 'otp' } } })

    expect(componentPackages(root)[0]).toMatchObject({ label: 'otp', title: 'otp' })
  })

  it('survives a directory that is mid-scaffold, with no manifest yet', async () => {
    const root = await fixture({ 'react-otp-input': component('otp') })
    await mkdir(join(root, 'packages', 'react-half-created'), { recursive: true })

    expect(componentPackages(root).map((pkg) => pkg.dir)).toEqual(['react-otp-input'])
  })

  it('survives an unparseable manifest rather than taking the whole build down', async () => {
    const root = await fixture({ 'react-otp-input': component('otp') })
    await mkdir(join(root, 'packages', 'react-broken'), { recursive: true })
    await writeFile(join(root, 'packages', 'react-broken', 'package.json'), '{ not json', 'utf8')

    expect(componentPackages(root).map((pkg) => pkg.dir)).toEqual(['react-otp-input'])
  })
})

describe('this repo', () => {
  // The real scan. Deliberately no expected list of names: one would have to be
  // edited for every new input, which is the coupling this registry exists to
  // remove. These assert invariants instead.
  const discovered = componentPackages()

  it('discovers components', () => {
    expect(discovered.length).toBeGreaterThan(0)
  })

  it('gives every component a unique slug', () => {
    const slugs = discovered.map((pkg) => pkg.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  /**
   * The cross-check that makes forgetting the declaration loud.
   *
   * A component package is recognisable structurally — it ships a `demo/` that
   * its own `e2e/` suite drives — and that shape is what the meta-package, the
   * codemod and the private tooling do not have. Without this, adding an input
   * and forgetting its `rxova` block would leave it undiscovered: absent from
   * the docs sidebar and from both CI matrices, with every job still green.
   */
  it('leaves no demo-carrying package undeclared', () => {
    const packagesDir = join(REPO_ROOT, 'packages')
    const looksLikeComponent = readdirSync(packagesDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .filter((entry) => existsSync(join(packagesDir, entry.name, 'demo')))
      .filter((entry) => existsSync(join(packagesDir, entry.name, 'e2e')))
      .map((entry) => entry.name)

    expect(looksLikeComponent.sort()).toEqual(discovered.map((pkg) => pkg.dir).sort())
  })
})
