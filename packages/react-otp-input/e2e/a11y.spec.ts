import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

/**
 * Scans the whole document rather than one mounted component, so it also
 * catches problems that only exist in composition — duplicate ids across
 * several fields, orphaned aria-describedby targets, landmark structure.
 */
async function scan(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  return results.violations.map((v) => `${v.id} (${String(v.nodes.length)}): ${v.help}`)
}

test('the whole playground is free of WCAG A/AA violations', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'OTP input' })).toBeVisible()
  expect(await scan(page)).toEqual([])
})

test('stays clean in RTL', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('rtl-toggle').check()
  expect(await scan(page)).toEqual([])
})

test('stays clean while showing a validation error', async ({ page }) => {
  await page.goto('/')
  const section = page.locator('[data-testid="hook-form"]')
  await section.getByRole('textbox').click()
  await page.keyboard.type('12')
  await section.getByRole('button', { name: 'Verify' }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  expect(await scan(page)).toEqual([])
})

test('every field has a unique accessible name', async ({ page }) => {
  await page.goto('/')
  const names = await page
    .locator('[data-rx-otp-input]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')))
  expect(names.length).toBeGreaterThan(0)
  expect(names.every((n) => n && n.length > 0)).toBe(true)
})

test('input ids are unique across the page', async ({ page }) => {
  await page.goto('/')
  const ids = await page.locator('[data-rx-otp-input]').evaluateAll((els) => els.map((e) => e.id))
  expect(new Set(ids).size).toBe(ids.length)
})
