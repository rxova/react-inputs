import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

/**
 * Scans the whole document rather than one mounted component, so it also
 * catches problems that only exist in composition — duplicate ids across
 * several maps, orphaned aria-describedby targets, landmark structure.
 */
async function scan(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  return results.violations.map((v) => `${v.id} (${String(v.nodes.length)}): ${v.help}`)
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Seat map input' })).toBeVisible()
})

test('the whole demo page is free of WCAG A/AA violations', async ({ page }) => {
  expect(await scan(page)).toEqual([])
})

test('stays clean once seats are chosen and refused', async ({ page }) => {
  await page.getByTestId('interactive').getByRole('checkbox', { name: '10A' }).click()
  await page
    .getByTestId('interactive')
    .getByRole('checkbox', { name: '11C, taken' })
    .click({ force: true })
  await page.getByTestId('rules').getByTestId('rules-best').click()
  expect(await scan(page)).toEqual([])
})

test('stays clean in RTL', async ({ page }) => {
  await page.getByTestId('rtl-toggle').check()
  expect(await scan(page)).toEqual([])
})

test('stays clean while a validation message is pending', async ({ page }) => {
  const form = page.getByTestId('native-form')
  await form.getByRole('checkbox', { name: '12A' }).click()
  await form.getByRole('button', { name: 'Submit' }).click()
  expect(await scan(page)).toEqual([])
})

test('every grid has a non-empty accessible name', async ({ page }) => {
  const grids = page.getByRole('grid')
  const count = await grids.count()
  expect(count).toBeGreaterThan(0)
  for (let index = 0; index < count; index++) {
    await expect(grids.nth(index)).toHaveAccessibleName(/\S/)
  }
})

test('every seat has a non-empty accessible name', async ({ page }) => {
  const names = await page
    .locator('[data-rx-seat-map-seat]')
    .evaluateAll((elements) => elements.map((el) => el.getAttribute('aria-label')))
  expect(names.length).toBeGreaterThan(0)
  for (const name of names) expect(name).toMatch(/\S/)
})

test('seat input ids are unique across the page', async ({ page }) => {
  // Several maps on one page must not collide, or a label lookup and
  // `document.getElementById` both resolve to the wrong seat.
  const ids = await page
    .locator('input[data-rx-seat-map-seat]')
    .evaluateAll((elements) => elements.map((el) => el.id))
  expect(ids.length).toBeGreaterThan(0)
  expect(new Set(ids).size).toBe(ids.length)
})

test('every sold seat states its status, not just its colour', async ({ page }) => {
  const sold = page.locator('[data-rx-seat-map-cell][data-state="occupied"] [aria-label]')
  const count = await sold.count()
  expect(count).toBeGreaterThan(0)
  for (let index = 0; index < count; index++) {
    await expect(sold.nth(index)).toHaveAttribute('aria-label', /taken/)
  }
})

test('every sold seat is still reachable by keyboard', async ({ page }) => {
  const focusable = await page
    .locator('[data-rx-seat-map-cell][data-state="occupied"] [data-rx-seat-map-seat]')
    .evaluateAll((elements) =>
      elements.map((el) => ({
        disabled: (el as HTMLInputElement).disabled,
        tabIndex: el.getAttribute('tabindex'),
      })),
    )
  expect(focusable.length).toBeGreaterThan(0)
  for (const entry of focusable) {
    expect(entry.disabled).toBe(false)
    expect(entry.tabIndex).not.toBeNull()
  }
})

test('every seat clears the 24x24 target-size floor', async ({ page }) => {
  const sizes = await page.locator('[data-rx-seat-map-cell]').evaluateAll((elements) =>
    elements.map((el) => {
      const rect = el.getBoundingClientRect()
      return [rect.width, rect.height] as const
    }),
  )
  expect(sizes.length).toBeGreaterThan(0)
  for (const [width, height] of sizes) {
    expect(width).toBeGreaterThanOrEqual(24)
    expect(height).toBeGreaterThanOrEqual(24)
  }
})

test('the focus ring survives a scroll container', async ({ page }) => {
  const scroller = page.getByTestId('scroller')
  await scroller.getByRole('checkbox', { name: '2A', exact: true }).click()
  await page.keyboard.press('ArrowDown')
  const outline = await page.evaluate(() => {
    const cell = document.querySelector('[data-focused]')
    return cell ? getComputedStyle(cell).outlineStyle : 'none'
  })
  expect(outline).not.toBe('none')
})
