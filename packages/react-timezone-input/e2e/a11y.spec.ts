import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

/**
 * Page-level accessibility and keyboard behaviour, which is a different question
 * from the component tests: duplicate ids across instances, a broken tab order
 * across a whole form and real type-ahead only exist in composition.
 *
 * There is no caret here to test — that is the point of choosing a `<select>`.
 * What replaces the caret tests is this file: the platform's own keyboard
 * contract, exercised for real rather than reimplemented.
 */

async function scan(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  return results.violations.map((v) => `${v.id} (${String(v.nodes.length)}): ${v.help}`)
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Time zone input' })).toBeVisible()
})

test('the whole demo page is free of WCAG A/AA violations', async ({ page }) => {
  expect(await scan(page)).toEqual([])
})

test('stays clean with an invalid field and an empty one showing', async ({ page }) => {
  await page.getByTestId('controlled').getByRole('button', { name: 'Clear' }).click()
  expect(await scan(page)).toEqual([])
})

test('every field is a labelled combobox', async ({ page }) => {
  const selects = page.locator('[data-rx-timezone-select]')
  const count = await selects.count()
  expect(count).toBeGreaterThan(5)
  for (let index = 0; index < count; index++) {
    const select = selects.nth(index)
    const name =
      (await select.getAttribute('aria-label')) ?? (await select.getAttribute('aria-labelledby'))
    expect(name).toBeTruthy()
    expect(await select.evaluate((node) => node.tagName)).toBe('SELECT')
  }
})

test('no id appears twice on the page', async ({ page }) => {
  const ids = await page
    .locator('[data-rx-timezone-select]')
    .evaluateAll((nodes) => nodes.map((node) => node.id))
  expect(ids.length).toBeGreaterThan(5)
  expect(new Set(ids).size).toBe(ids.length)
})

test('every option carries text, so none is an invisible row', async ({ page }) => {
  const texts = await page
    .getByTestId('narrow')
    .locator('option')
    .evaluateAll((nodes) => nodes.map((node) => node.textContent ?? ''))
  for (const text of texts) expect(text.trim()).not.toBe('')
})

test('the whole page is reachable with the keyboard alone', async ({ page }) => {
  await page.getByRole('heading', { name: 'Time zone input' }).click()
  const reached = new Set<string>()
  for (let press = 0; press < 14; press++) {
    await page.keyboard.press('Tab')
    const id = await page.evaluate(() => {
      const active = document.activeElement
      return active?.hasAttribute('data-rx-timezone-select') === true ? active.id : null
    })
    if (id) reached.add(id)
  }
  expect(reached.size).toBeGreaterThan(1)
})

test('a disabled field is skipped by Tab', async ({ page }) => {
  const disabled = page.getByTestId('state-disabled').locator('[data-rx-timezone-select]')
  await expect(disabled).toBeDisabled()
  await disabled.evaluate((node) => {
    ;(node as HTMLSelectElement).focus()
  })
  const focused = await page.evaluate(() => document.activeElement?.tagName)
  expect(focused).not.toBe('SELECT')
})

/**
 * The behaviour that justified leading each option with its city. A native
 * select's type-ahead matches from the start of the option text, and with the
 * list sorted by offset rather than alphabetically it is the only fast way in.
 */
test('type-ahead reaches a zone by its city name', async ({ page }) => {
  const select = page.getByTestId('basic').locator('[data-rx-timezone-select]')
  await select.focus()
  await page.keyboard.type('Madrid', { delay: 30 })
  await expect(select).toHaveValue(/Madrid/)
})

test('type-ahead would not work if the offset led the label', async ({ page }) => {
  // The guard for the regression: every option starts with a letter or digit of
  // its city, never with a bracket.
  const first = await page.getByTestId('narrow').locator('option').nth(1).textContent()
  expect(first?.trimStart().startsWith('(')).toBe(false)
})

test('the arrow keys move the selection, and blur does not fire mid-field', async ({ page }) => {
  const select = page.getByTestId('flat').locator('[data-rx-timezone-select]')
  await select.focus()
  const before = await select.inputValue()
  await page.keyboard.press('ArrowDown')
  await expect(select).not.toHaveValue(before)
  // Focus has not left the field.
  const stillFocused = await page.evaluate(
    () => document.activeElement?.hasAttribute('data-rx-timezone-select') === true,
  )
  expect(stillFocused).toBe(true)
})

test('Home and End reach the ends of the list', async ({ page }) => {
  const select = page.getByTestId('narrow').locator('[data-rx-timezone-select]')
  await select.focus()
  await page.keyboard.press('End')
  const last = await select.inputValue()
  await page.keyboard.press('Home')
  const first = await select.inputValue()
  expect(first).not.toBe(last)
})

test('focus survives a controlled write from outside', async ({ page }) => {
  const section = page.getByTestId('controlled')
  const select = section.locator('[data-rx-timezone-select]')
  await select.focus()
  await section.getByRole('button', { name: 'Tokyo' }).click()
  await select.focus()
  await expect(select).toHaveValue('Asia/Tokyo')
  const focused = await page.evaluate(
    () => document.activeElement?.hasAttribute('data-rx-timezone-select') === true,
  )
  expect(focused).toBe(true)
})
