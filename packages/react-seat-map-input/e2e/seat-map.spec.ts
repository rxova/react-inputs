import { expect, test } from '@playwright/test'

/**
 * Whole-page behaviour: tab order across several maps, a real form round-trip,
 * page-level RTL, and real scrolling. The component suites cannot reach any of
 * these — a roving tabindex that is right inside one mounted component can
 * still be wrong on a page holding four of them.
 */

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Seat map input' })).toBeVisible()
})

const seat = (name: string) => ({ role: 'checkbox' as const, name })

test('picks and clears a seat with the pointer', async ({ page }) => {
  const map = page.getByTestId('interactive')
  await map.getByRole('checkbox', { name: '10B' }).click()
  await expect(page.getByTestId('interactive-value')).toHaveText('10B')
  await map.getByRole('checkbox', { name: '10B' }).click()
  await expect(page.getByTestId('interactive-value')).toHaveText('none')
})

test('refuses a sold seat and names the reason', async ({ page }) => {
  const map = page.getByTestId('interactive')
  await map.getByRole('checkbox', { name: '11C, taken' }).click({ force: true })
  await expect(page.getByTestId('interactive-reject')).toHaveText('unavailable')
  await expect(page.getByTestId('interactive-value')).toHaveText('none')
})

test('refuses past the cap', async ({ page }) => {
  const map = page.getByTestId('interactive')
  for (const name of ['10A', '10B', '10C', '10D']) {
    await map.getByRole('checkbox', { name }).click()
  }
  await map.getByRole('checkbox', { name: '12A' }).click()
  await expect(page.getByTestId('interactive-reject')).toHaveText('max-seats')
})

test('walks the cabin with the arrow keys, stepping over the aisle', async ({ page }) => {
  const map = page.getByTestId('interactive')
  await map.getByRole('checkbox', { name: '10B' }).click()
  await page.keyboard.press('ArrowRight')
  await expect(map.getByRole('checkbox', { name: '10C' })).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(map.getByRole('checkbox', { name: '11C, taken' })).toBeFocused()
})

test('reaches sold seats by keyboard, which is the whole point', async ({ page }) => {
  const map = page.getByTestId('interactive')
  await map.getByRole('checkbox', { name: '12C' }).click()
  await page.keyboard.press('ArrowUp')
  await expect(map.getByRole('checkbox', { name: '11C, taken' })).toBeFocused()
  await page.keyboard.press('ArrowUp')
  await expect(map.getByRole('checkbox', { name: '10C' })).toBeFocused()
})

test('Home and End reach the ends of the row', async ({ page }) => {
  const map = page.getByTestId('interactive')
  await map.getByRole('checkbox', { name: '10B' }).click()
  await page.keyboard.press('End')
  await expect(map.getByRole('checkbox', { name: '10F' })).toBeFocused()
  await page.keyboard.press('Home')
  await expect(map.getByRole('checkbox', { name: '10A' })).toBeFocused()
})

test('Control+Home and Control+End reach the ends of the section', async ({ page }) => {
  const map = page.getByTestId('interactive')
  await map.getByRole('checkbox', { name: '12A' }).click()
  await page.keyboard.press('Control+End')
  await expect(map.getByRole('checkbox', { name: '15F' })).toBeFocused()
  await page.keyboard.press('Control+Home')
  await expect(map.getByRole('checkbox', { name: '10A' })).toBeFocused()
})

test('extends a block with Shift and an arrow', async ({ page }) => {
  const map = page.getByTestId('interactive')
  await map.getByRole('checkbox', { name: '10A' }).click()
  await page.keyboard.press('Shift+ArrowRight')
  await expect(page.getByTestId('interactive-value')).toHaveText('10A 10B')
})

test('no grid occupies two consecutive tab stops', async ({ page }) => {
  // Phrased as "never the same grid twice in a row" rather than an exact count,
  // because engines disagree about which non-form elements are tabbable at all.
  // A hundred seats must cost one Tab, or the field is unusable in a real form.
  await page.getByRole('heading', { name: 'Seat map input' }).click()
  const seen: string[] = []
  for (let step = 0; step < 40; step++) {
    await page.keyboard.press('Tab')
    seen.push(
      await page.evaluate(() => {
        const grids = [...document.querySelectorAll('[role="grid"]')]
        const grid = document.activeElement?.closest('[role="grid"]')
        return grid ? `grid-${String(grids.indexOf(grid))}` : 'other'
      }),
    )
  }
  expect(seen.filter((entry) => entry !== 'other').length).toBeGreaterThan(0)
  for (let index = 1; index < seen.length; index++) {
    if (seen[index] === 'other') continue
    expect(seen[index]).not.toBe(seen[index - 1])
  }
})

test('each section is its own grid with its own tab stop', async ({ page }) => {
  const map = page.getByTestId('sections')
  await expect(map.getByRole('grid')).toHaveCount(2)
  // Both grids hold a seat labelled `AA` — a theatre really does have a row A
  // in the stalls and another in the circle — so every lookup is grid-scoped.
  await map.getByRole('grid', { name: 'Stalls' }).getByRole('checkbox', { name: 'AA' }).click()
  await page.keyboard.press('Tab')
  await expect(
    map.getByRole('grid', { name: 'Circle' }).getByRole('checkbox', { name: 'AA' }),
  ).toBeFocused()
})

test('a native form posts a real array under one name', async ({ page }) => {
  const form = page.getByTestId('native-form')
  await form.getByRole('checkbox', { name: '12A' }).click()
  await form.getByRole('checkbox', { name: '12B' }).click()
  await form.getByRole('button', { name: 'Submit' }).click()
  await expect(page.getByTestId('native-form-result')).toHaveText('12A 12B')
})

test('the browser blocks a submission below the minimum', async ({ page }) => {
  const form = page.getByTestId('native-form')
  await form.getByRole('checkbox', { name: '12A' }).click()
  await form.getByRole('button', { name: 'Submit' }).click()
  await expect(page.getByTestId('native-form-result')).toHaveText('not submitted')
  const message = await form
    .locator('[data-rx-seat-map-seat="12A"]')
    .evaluate((node: HTMLInputElement) => node.validationMessage)
  expect(message).toBe('Choose at least 2 seats.')
})

test('react-hook-form receives the chosen seats', async ({ page }) => {
  const form = page.getByTestId('hook-form')
  await form.getByRole('checkbox', { name: '12C' }).click()
  await form.getByRole('button', { name: 'Submit' }).click()
  await expect(page.getByTestId('hook-form-result')).toHaveText('12C')
})

test('the rules block explains a broken run and a stranded seat', async ({ page }) => {
  const map = page.getByTestId('rules')
  await map.getByRole('checkbox', { name: '12A' }).click()
  await map.getByRole('checkbox', { name: '12C' }).click()
  await expect(page.getByTestId('rules-reject')).toHaveText('12C is not next to your other seats.')
})

test('finds the best pair of adjacent seats', async ({ page }) => {
  const map = page.getByTestId('rules')
  await map.getByTestId('rules-best').click()
  await expect(page.getByTestId('rules-value')).toHaveText('12B 12C')
})

test('a read-only map is a navigable diagram, not a set of controls', async ({ page }) => {
  const map = page.getByTestId('read-only')
  await expect(map.getByRole('checkbox')).toHaveCount(0)
  await expect(map.getByRole('grid')).toHaveAttribute('aria-readonly', 'true')
  await map.getByRole('gridcell', { name: '12A' }).click()
  await page.keyboard.press('ArrowRight')
  await expect(map.getByRole('gridcell', { name: '12B' })).toBeFocused()
})

test('a disabled map is out of the tab order but still announced', async ({ page }) => {
  const map = page.getByTestId('disabled')
  await expect(map.locator('[data-disabled]')).toHaveCount(1)
  const tabbable = await map.locator('[data-rx-seat-map-seat][tabindex="0"]').count()
  expect(tabbable).toBe(1)
  const disabled = await map
    .locator('[data-rx-seat-map-seat]')
    .first()
    .evaluate((node: HTMLInputElement) => node.disabled)
  expect(disabled).toBe(true)
})

test('announces every pick and every refusal', async ({ page }) => {
  const map = page.getByTestId('interactive')
  const region = map.locator('[data-rx-seat-map-announcement]')
  await map.getByRole('checkbox', { name: '10A' }).click()
  await expect(region).toHaveText('10A selected. 1 of 4 seats chosen.')
  await map.getByRole('checkbox', { name: '11C, taken' }).click({ force: true })
  await expect(region).toHaveText('11C is already taken.')
})

test('follows the visual direction in RTL', async ({ page }) => {
  await page.getByTestId('rtl-toggle').check()
  const map = page.getByTestId('interactive')
  await map.getByRole('checkbox', { name: '10B' }).click()
  await page.keyboard.press('ArrowLeft')
  await expect(map.getByRole('checkbox', { name: '10C' })).toBeFocused()
})

test('scrolls the focused seat into view without moving the page', async ({ page }) => {
  const scroller = page.getByTestId('scroller')
  await scroller.getByRole('checkbox', { name: '2A', exact: true }).click()
  const before = await scroller.evaluate((node) => node.scrollTop)
  const pageBefore = await page.evaluate(() => window.scrollY)

  for (let step = 0; step < 3; step++) await page.keyboard.press('PageDown')

  expect(await scroller.evaluate((node) => node.scrollTop)).toBeGreaterThan(before)
  // `block: 'nearest'` keeps the surrounding document where the user left it.
  expect(await page.evaluate(() => window.scrollY)).toBe(pageBefore)
})

test('completes a booking with the keyboard alone', async ({ page }) => {
  const form = page.getByTestId('native-form')
  await form.getByRole('heading', { name: 'Native form' }).click()
  await page.keyboard.press('Tab')
  await expect(form.getByRole(seat('12A').role, { name: seat('12A').name })).toBeFocused()
  await page.keyboard.press('Space')
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Tab')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('native-form-result')).toHaveText('12A 12B')
})
