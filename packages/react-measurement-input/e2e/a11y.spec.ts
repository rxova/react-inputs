import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

/**
 * Page-level accessibility, which is a different question from the component
 * tests: duplicate ids across instances and a broken tab order across a whole
 * form only exist in composition, and no single-component test can see them.
 */

const seg = (unit: string) => `[data-rx-measurement-segment="${unit}"]`

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
  await expect(page.getByRole('heading', { name: 'Measurement input' })).toBeVisible()
})

test('the whole demo page is free of WCAG A/AA violations', async ({ page }) => {
  expect(await scan(page)).toEqual([])
})

test('stays clean with an out-of-range measurement showing', async ({ page }) => {
  await page.getByTestId('range').locator(seg('foot')).click()
  await page.keyboard.type('0300')
  await expect(page.getByTestId('range').locator('[data-rx-measurement-root]')).toHaveAttribute(
    'data-out-of-range',
    '',
  )
  expect(await scan(page)).toEqual([])
})

test('stays clean mid-entry, with a segment holding an un-carried number', async ({ page }) => {
  await page.getByTestId('carry').locator(seg('inch')).click()
  await page.keyboard.type('14')
  expect(await scan(page)).toEqual([])
})

test('every field is a labelled group of spinbuttons', async ({ page }) => {
  const groups = page.locator('[data-rx-measurement-root]')
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
    .locator('[data-rx-measurement-segment]')
    .evaluateAll((nodes) => nodes.map((node) => node.id))
  expect(ids.length).toBeGreaterThan(10)
  expect(new Set(ids).size).toBe(ids.length)
})

test('every segment carries a real accessible name, never the abbreviation', async ({ page }) => {
  const labels = await page
    .locator('[data-rx-measurement-segment]')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label') ?? ''))
  for (const label of labels) {
    // Non-empty, and never the one- or two-letter suffix beside it. Length
    // alone is the wrong test: some locales name a unit in one character.
    expect(label).not.toBe('')
    expect(label).not.toMatch(/^[a-zA-Z]{1,2}$/)
  }
})

test('the leading segment promises no ceiling it cannot keep', async ({ page }) => {
  const single = page.getByTestId('units-single').locator(seg('centimeter'))
  await expect(single).not.toHaveAttribute('aria-valuemax', /.*/)
  await expect(single).toHaveAttribute('aria-valuemin', '0')

  // A trailing segment does have one, and says so.
  await expect(page.getByTestId('units-imperial').locator(seg('inch'))).toHaveAttribute(
    'aria-valuemax',
    '11',
  )
})

test('a temperature promises no floor either', async ({ page }) => {
  const celsius = page.getByTestId('temp-c').locator(seg('celsius'))
  await expect(celsius).not.toHaveAttribute('aria-valuemin', /.*/)
  await expect(celsius).not.toHaveAttribute('aria-valuemax', /.*/)
})

test('a value reads as a quantity, not as a bare digit', async ({ page }) => {
  await expect(page.getByTestId('locale-en').locator(seg('foot'))).toHaveAttribute(
    'aria-valuetext',
    '5 feet',
  )
})

test('the whole page is reachable with the keyboard alone', async ({ page }) => {
  await page.getByRole('heading', { name: 'Measurement input' }).click()
  const reached = new Set<string>()
  for (let press = 0; press < 12; press++) {
    await page.keyboard.press('Tab')
    const unit = await page.evaluate(() =>
      document.activeElement?.getAttribute('data-rx-measurement-segment'),
    )
    if (unit) reached.add(unit)
  }
  expect(reached.size).toBeGreaterThan(1)
})

test('a disabled field is skipped by Tab, and a read-only one is not', async ({ page }) => {
  await expect(page.getByTestId('state-disabled').locator(seg('foot'))).toHaveAttribute(
    'tabindex',
    '-1',
  )
  await expect(page.getByTestId('state-readonly').locator(seg('foot'))).toHaveAttribute(
    'tabindex',
    '0',
  )
})

test('the focused segment paints a visible ring', async ({ page }) => {
  const target = page.getByTestId('carry').locator(seg('foot'))
  await target.click()
  await expect(target).toHaveAttribute('data-focused', '')
  const outline = await target.evaluate((node) => getComputedStyle(node).outlineStyle)
  expect(outline).not.toBe('none')
})
