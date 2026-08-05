import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

/**
 * Scans the whole document rather than one mounted component, so it also
 * catches problems that only exist in composition — duplicate ids across
 * several fields, orphaned label targets, heading structure.
 */
async function scan(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  return results.violations.map((v) => `${v.id} (${String(v.nodes.length)}): ${v.help}`)
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Phone input' })).toBeVisible()
})

test('the whole demo page is free of WCAG A/AA violations', async ({ page }) => {
  expect(await scan(page)).toEqual([])
})

test('stays clean with numbers entered', async ({ page }) => {
  await page.locator('[data-testid="basic"] [data-rx-phone-input]').click()
  await page.keyboard.type('4155552671')
  await page.locator('[data-testid="details"] [data-rx-phone-input]').click()
  await page.keyboard.type('+33612345678')
  expect(await scan(page)).toEqual([])
})

test('every number field has an accessible name', async ({ page }) => {
  const names = await page
    .locator('[data-rx-phone-input]')
    .evaluateAll((elements) =>
      elements.map((element) =>
        element.id
          ? (document.querySelector(`label[for="${element.id}"]`)?.textContent ?? null)
          : null,
      ),
    )
  expect(names.length).toBeGreaterThan(0)
  expect(names.every((name) => typeof name === 'string' && name.trim().length > 0)).toBe(true)
})

test('every country select has an accessible name', async ({ page }) => {
  const names = await page
    .locator('[data-rx-phone-country]')
    .evaluateAll((elements) => elements.map((element) => element.getAttribute('aria-label')))
  expect(names.length).toBeGreaterThan(0)
  expect(names.every((name) => typeof name === 'string' && name.length > 0)).toBe(true)
})

test('no option in any picker is blank', async ({ page }) => {
  // An unknown ISO code or a missing Intl name would render an empty option,
  // which is unreachable by type-ahead and meaningless to a screen reader.
  const blanks = await page
    .locator('[data-rx-phone-country] option')
    .evaluateAll(
      (elements) =>
        elements.filter((element) => (element.textContent ?? '').trim().length < 3).length,
    )
  expect(blanks).toBe(0)
})

test('the field can be filled without a pointer', async ({ page }) => {
  const section = page.locator('[data-testid="details"]')
  await section.locator('[data-rx-phone-country]').focus()
  await page.keyboard.press('Tab')
  await page.keyboard.type('2071234567')
  await expect(page.getByTestId('e164')).toHaveText('+442071234567')
})
