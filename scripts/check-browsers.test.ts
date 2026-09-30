import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { checkBrowserConfigs } from './check-browsers'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function fixture(config = "basePlaywrightConfig({ port: 1, browsers: ['chromium'] })") {
  const root = mkdtempSync(join(tmpdir(), 'rxova-browsers-'))
  roots.push(root)
  mkdirSync(join(root, 'packages', 'component'), { recursive: true })
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({
      scripts: {
        e2e: 'turbo run e2e --concurrency=3',
        'e2e:serial': 'turbo run e2e --concurrency=1',
        'e2e:install': 'playwright install chromium firefox webkit',
      },
    }),
  )
  writeFileSync(join(root, 'packages', 'component', 'playwright.config.ts'), config)
  return root
}

describe('checkBrowserConfigs', () => {
  it('accepts bounded workers and an installed project', () => {
    expect(checkBrowserConfigs(fixture()).failures).toEqual([])
  })

  it('accepts the preset default of Chromium alone', () => {
    expect(checkBrowserConfigs(fixture('basePlaywrightConfig({ port: 1 })')).failures).toEqual([])
  })

  it('rejects a config that is not built on the shared preset', () => {
    const failures = checkBrowserConfigs(
      fixture("defineConfig({ projects: [{ name: 'chromium' }] })"),
    ).failures
    expect(failures).toContain(
      'packages/component/playwright.config.ts is not built on basePlaywrightConfig',
    )
  })

  it('rejects worker fan-out', () => {
    const failures = checkBrowserConfigs(
      fixture('basePlaywrightConfig({ port: 1, workers: process.env.CI ? 1 : undefined })'),
    ).failures
    expect(failures).toContain(
      'packages/component/playwright.config.ts must leave `workers` at 1, found `process.env.CI ? 1 : undefined`',
    )
  })

  it('rejects a browser missing from the installer', () => {
    const failures = checkBrowserConfigs(
      fixture("basePlaywrightConfig({ port: 1, browsers: ['chromium', 'safari'] })"),
    ).failures
    expect(failures.join('\n')).toContain('e2e:install omits safari')
  })

  it('rejects unbounded root orchestration', () => {
    const root = fixture()
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify({ scripts: { e2e: 'turbo run e2e', 'e2e:install': 'chromium' } }),
    )
    expect(checkBrowserConfigs(root).failures).toEqual(
      expect.arrayContaining([
        'root `e2e` must cap Turbo package concurrency at 3',
        'root `e2e:serial` must cap Turbo package concurrency at 1',
      ]),
    )
  })
})
