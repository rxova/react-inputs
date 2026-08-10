import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

/**
 * Page-level accessibility, which is a different question from the component
 * tests: duplicate ids across instances and a broken tab order across a whole
 * form only exist in composition, and no single-component test can see them.
 */

const seg = (unit: string) => `[data-rx-duration-segment="${unit}"]`

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
  await expect(page.getByRole('heading', { name: 'Duration input' })).toBeVisible()
})

test('the whole demo page is free of WCAG A/AA violations', async ({ page }) => {
  expect(await scan(page)).toEqual([])
})

test('stays clean with an out-of-range duration showing', async ({ page }) => {
  await page.getByTestId('range').locator(seg('hour')).click()
  await page.keyboard.type('0500')
  await expect(page.getByTestId('range').locator('[data-rx-duration-root]')).toHaveAttribute(
    'data-out-of-range',
    '',
  )
  expect(await scan(page)).toEqual([])
})

test('stays clean mid-entry, with a segment holding an un-carried number', async ({ page }) => {
  await page.getByTestId('carry').locator(seg('minute')).click()
  await page.keyboard.type('90')
  expect(await scan(page)).toEqual([])
})

test('every field is a labelled group of spinbuttons', async ({ page }) => {
  const groups = page.locator('[data-rx-duration-root]')
  const count = await groups.count()
  expect(count).toBeGreaterThan(5)
  for (let index = 0; index < count; index++) {
    const group = groups.nth(index)
    await expect(group).toHaveAttribute('role', 'group')
    const name =
      (await group.getAttribute('aria-label')) ?? (await group.getAttribute('aria-labelledby'))
    expect(name).toBeTruthy()
    expect(await group.locator('[role="spinbutton"]').count()).toBeGreaterThan(0)
  }
})

test('no id appears twice on the page', async ({ page }) => {
  const ids = await page
    .locator('[data-rx-duration-segment]')
    .evaluateAll((nodes) => nodes.map((node) => node.id))
  expect(ids.length).toBeGreaterThan(10)
  expect(new Set(ids).size).toBe(ids.length)
})

test('every segment carries a real accessible name, never the abbreviation', async ({ page }) => {
  const labels = await page
    .locator('[data-rx-duration-segment]')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label') ?? ''))
  for (const label of labels) {
    // Non-empty, and never the one-letter suffix beside it. Length alone is the
    // wrong test: `ja` names the minute 分, which is a whole word in one
    // character.
    expect(label).not.toBe('')
    expect(label).not.toMatch(/^[a-zA-Z]$/)
  }
})

test('the leading segment promises no ceiling it cannot keep', async ({ page }) => {
  const minutesOnly = page.getByTestId('units-minutes').locator(seg('minute'))
  await expect(minutesOnly).not.toHaveAttribute('aria-valuemax', /.*/)
  await expect(minutesOnly).toHaveAttribute('aria-valuemin', '0')

  // A trailing segment does have one, and says so.
  await expect(page.getByTestId('units-hms').locator(seg('minute'))).toHaveAttribute(
    'aria-valuemax',
    '59',
  )
})

test('a value reads as a quantity, not as a bare digit', async ({ page }) => {
  await expect(page.getByTestId('locale-en').locator(seg('hour'))).toHaveAttribute(
    'aria-valuetext',
    '2 hours',
  )
})

test('the whole page is reachable with the keyboard alone', async ({ page }) => {
  await page.getByRole('heading', { name: 'Duration input' }).click()
  const reached = new Set<string>()
  for (let press = 0; press < 12; press++) {
    await page.keyboard.press('Tab')
    const unit = await page.evaluate(() =>
      document.activeElement?.getAttribute('data-rx-duration-segment'),
    )
    if (unit) reached.add(unit)
  }
  expect(reached.size).toBeGreaterThan(1)
})

test('a disabled field is skipped by Tab, and a read-only one is not', async ({ page }) => {
  await expect(page.getByTestId('state-disabled').locator(seg('hour'))).toHaveAttribute(
    'tabindex',
    '-1',
  )
  await expect(page.getByTestId('state-readonly').locator(seg('hour'))).toHaveAttribute(
    'tabindex',
    '0',
  )
})

test('the focused segment paints a visible ring', async ({ page }) => {
  const target = page.getByTestId('carry').locator(seg('hour'))
  await target.click()
  await expect(target).toHaveAttribute('data-focused', '')
  const outline = await target.evaluate((node) => getComputedStyle(node).outlineStyle)
  expect(outline).not.toBe('none')
})
