import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

/**
 * Scans the whole document rather than one mounted component, so it also
 * catches problems that only exist in composition — duplicate ids across
 * several fields, orphaned aria-describedby targets, heading structure.
 */
async function scan(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  return results.violations.map((v) => `${v.id} (${String(v.nodes.length)}): ${v.help}`)
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Password input' })).toBeVisible()
})

test('the whole demo page is free of WCAG A/AA violations', async ({ page }) => {
  expect(await scan(page)).toEqual([])
})

test('stays clean with every password revealed', async ({ page }) => {
  // Located by attribute, not by accessible name: clicking a toggle renames it
  // from "Show password" to "Hide password", so a name-based list goes stale
  // the moment the first one is clicked.
  const toggles = page.locator('[data-rx-password-toggle]')
  for (let index = 0; index < (await toggles.count()); index++) {
    const toggle = toggles.nth(index)
    if (await toggle.isEnabled()) await toggle.click()
  }
  expect(await scan(page)).toEqual([])
})

test('stays clean while the meter, checklist and breach alert are all showing', async ({
  page,
}) => {
  await page.locator('[data-testid="strength"] [data-rx-password-input]').fill('Kq7#mVx2Lp!wZ')
  await page.locator('[data-testid="breach"] [data-rx-password-input]').fill('hunter2')
  await expect(page.locator('[data-testid="breach"]').getByRole('alert')).toBeVisible()
  expect(await scan(page)).toEqual([])
})

test('every password field has an accessible name', async ({ page }) => {
  const names = await page.locator('[data-rx-password-input]').evaluateAll((elements) =>
    elements.map((element) => {
      const labelled = element.id
        ? document.querySelector(`label[for="${element.id}"]`)?.textContent
        : null
      return labelled ?? element.getAttribute('aria-label')
    }),
  )
  expect(names.length).toBeGreaterThan(0)
  expect(names.every((name) => typeof name === 'string' && name.trim().length > 0)).toBe(true)
})

test('every aria-describedby points at an element that exists', async ({ page }) => {
  const dangling = await page.evaluate(() => {
    const bad: string[] = []
    for (const element of document.querySelectorAll('[aria-describedby]')) {
      for (const id of (element.getAttribute('aria-describedby') ?? '').split(/\s+/)) {
        if (id && !document.getElementById(id)) bad.push(id)
      }
    }
    return bad
  })
  expect(dangling).toEqual([])
})

test('every reveal toggle meets the minimum target size', async ({ page }) => {
  // WCAG 2.5.8 Target Size (Minimum): 24x24 CSS pixels.
  const boxes = await page.locator('[data-rx-password-toggle]').evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect()
      return { width: rect.width, height: rect.height }
    }),
  )
  expect(boxes.length).toBeGreaterThan(0)
  for (const box of boxes) {
    expect(box.width).toBeGreaterThanOrEqual(24)
    expect(box.height).toBeGreaterThanOrEqual(24)
  }
})
