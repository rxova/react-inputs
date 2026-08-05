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
  await expect(page.getByRole('heading', { name: 'Tags input' })).toBeVisible()
})

test('the whole demo page is free of WCAG A/AA violations', async ({ page }) => {
  expect(await scan(page)).toEqual([])
})

test('stays clean after adding and rejecting tags', async ({ page }) => {
  await page.locator('[data-testid="basic"] [data-rx-tags-input]').click()
  await page.keyboard.type('react')
  await page.keyboard.press('Enter')
  await page.locator('[data-testid="rules"] [data-rx-tags-input]').click()
  await page.keyboard.type('a')
  await page.keyboard.press('Enter')
  expect(await scan(page)).toEqual([])
})

test('every entry box has an accessible name', async ({ page }) => {
  // Playwright's own accessible-name computation rather than a hand-rolled
  // read of `label[for]`: `label` on this component is the accessible name and
  // renders no element, so the only honest check is the one the browser's
  // accessibility tree would answer. The native-form demo supplies its own
  // visible `<label for>`, which this must also accept.
  const fields = page.locator('[data-rx-tags-input]')
  const count = await fields.count()
  expect(count).toBeGreaterThan(0)
  for (let i = 0; i < count; i++) {
    await expect(fields.nth(i)).toHaveAccessibleName(/\S/)
  }
})

test('every remove button names its own tag', async ({ page }) => {
  // A list of buttons all called "Remove" is unusable in a screen reader's
  // element list, where they appear stripped of their surrounding text.
  const names = await page
    .locator('[data-rx-tags-remove]')
    .evaluateAll((elements) => elements.map((el) => el.getAttribute('aria-label')))
  expect(names.length).toBeGreaterThan(0)
  for (const name of names) {
    expect(name).toBeTruthy()
    expect(name).not.toBe('Remove')
  }
})

test('every tag list is a real list', async ({ page }) => {
  // So a screen reader announces "list, 3 items" before reading them.
  const tags = await page
    .locator('[data-rx-tags-list]')
    .evaluateAll((elements) => elements.map((el) => el.tagName))
  expect(tags.length).toBeGreaterThan(0)
  expect(tags.every((tag) => tag === 'UL')).toBe(true)
})

test('every list keeps exactly one tab stop', async ({ page }) => {
  const perList = await page
    .locator('[data-rx-tags-list]')
    .evaluateAll((lists) =>
      lists.map(
        (list) =>
          Array.from(list.querySelectorAll<HTMLElement>('[data-rx-tags-remove]')).filter(
            (button) => button.tabIndex === 0,
          ).length,
      ),
    )
  // A read-only list has no buttons at all; every other list has exactly one
  // tab stop however many tags it holds.
  for (const count of perList) expect(count).toBeLessThanOrEqual(1)
  expect(perList.some((count) => count === 1)).toBe(true)
})

test('every live region is polite, never assertive', async ({ page }) => {
  // A tag field is not an emergency; assertive would interrupt whatever the
  // user is already hearing.
  const modes = await page
    .locator('[data-rx-tags-announcement]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('aria-live')))
  expect(modes.length).toBeGreaterThan(0)
  expect(modes.every((mode) => mode === 'polite')).toBe(true)
})

test('the field can be filled and emptied without a pointer', async ({ page }) => {
  await page.locator('[data-testid="basic"] [data-rx-tags-input]').focus()
  await page.keyboard.type('one')
  await page.keyboard.press('Enter')
  await page.keyboard.type('two')
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-testid="basic"] [data-rx-tags-label]')).toHaveCount(2)

  await page.keyboard.press('Backspace')
  await page.keyboard.press('Backspace')
  await page.keyboard.press('Backspace')
  await page.keyboard.press('Backspace')
  await expect(page.locator('[data-testid="basic"] [data-rx-tags-label]')).toHaveCount(0)
})
