import { expect, test } from '@playwright/test'

/**
 * Runs on Chromium, Firefox and WebKit — and for this component that is not a
 * formality. The entire segment layout comes from `Intl.DateTimeFormat`, and
 * the three engines ship three different ICU builds, so "does `en-GB` really
 * put the day first here" is a question only a real run in each engine can
 * answer. Anything needing a whole page (tab order across a form, ids unique
 * across instances, a native submit round-trip) also belongs here.
 */
test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Date input' })).toBeVisible()
})

test('lays out segments in the locale order, in every engine', async ({ page }) => {
  // The assertion that most justifies running all three engines: each ships a
  // different ICU build, and this is the only place that claim is checked.
  const read = (testId: string) =>
    page
      .locator(`[data-testid="${testId}"] [data-rx-date-segment]`)
      .evaluateAll((elements) => elements.map((el) => el.getAttribute('data-rx-date-segment')))

  expect(await read('locale-us')).toEqual(['month', 'day', 'year'])
  expect(await read('locale-gb')).toEqual(['day', 'month', 'year'])
  expect(await read('locale-jp')).toEqual(['year', 'month', 'day'])
  expect(await read('locale-de')).toEqual(['day', 'month', 'year'])
})

test('never starts or ends with a separator, in any locale', async ({ page }) => {
  const roots = page.locator('[data-testid="locales"] [data-rx-date-root]')
  for (let index = 0; index < (await roots.count()); index++) {
    const kinds = await roots
      .nth(index)
      .locator(':scope > span')
      .evaluateAll((elements) =>
        elements.map((element) =>
          element.hasAttribute('data-rx-date-segment') ? 'segment' : 'literal',
        ),
      )
    expect(kinds.at(0)).toBe('segment')
    expect(kinds.at(-1)).toBe('segment')
  }
})

test('fills a date by typing, with auto-advance', async ({ page }) => {
  const section = page.locator('[data-testid="controlled"]')
  await section.locator('[data-rx-date-segment="day"]').click()
  await page.keyboard.type('01011999')

  await expect(section.locator('[data-rx-date-segment="day"]')).toHaveText('01')
  await expect(section.locator('[data-rx-date-segment="month"]')).toHaveText('01')
  await expect(section.locator('[data-rx-date-segment="year"]')).toHaveText('1999')
  await expect(page.getByTestId('value')).toHaveText('1999-01-01')
})

test('steps with the arrow keys and wraps at the ends', async ({ page }) => {
  const section = page.locator('[data-testid="controlled"]')
  const month = section.locator('[data-rx-date-segment="month"]')
  await month.click()
  await page.keyboard.press('ArrowUp')
  await expect(month).toHaveText('04')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowDown')
  await expect(month).toHaveText('02')
})

test('re-clamps the day when the month can no longer hold it', async ({ page }) => {
  const section = page.locator('[data-testid="controlled"]')
  await page.getByRole('button', { name: 'Set leap day' }).click()
  await expect(section.locator('[data-rx-date-segment="day"]')).toHaveText('29')

  await section.locator('[data-rx-date-segment="year"]').click()
  await page.keyboard.type('2023')
  // 28, never a rollover into March.
  await expect(section.locator('[data-rx-date-segment="day"]')).toHaveText('28')
  await expect(section.locator('[data-rx-date-segment="month"]')).toHaveText('02')
  await expect(page.getByTestId('value')).toHaveText('2023-02-28')
})

test('moves between segments with the arrow keys and stops at the ends', async ({ page }) => {
  const section = page.locator('[data-testid="controlled"]')
  await section.locator('[data-rx-date-segment="day"]').click()
  await page.keyboard.press('ArrowRight')
  await expect(section.locator('[data-rx-date-segment="month"]')).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  await expect(section.locator('[data-rx-date-segment="year"]')).toBeFocused()
})

test('gives each segment its own tab stop', async ({ page }) => {
  const section = page.locator('[data-testid="controlled"]')
  await section.locator('[data-rx-date-segment="day"]').click()
  await page.keyboard.press('Tab')
  await expect(section.locator('[data-rx-date-segment="month"]')).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(section.locator('[data-rx-date-segment="year"]')).toBeFocused()
})

test('clears a segment with Backspace', async ({ page }) => {
  const section = page.locator('[data-testid="controlled"]')
  await section.locator('[data-rx-date-segment="day"]').click()
  await page.keyboard.press('Backspace')
  await expect(section.locator('[data-rx-date-segment="day"]')).toHaveText('dd')
  await expect(page.getByTestId('value')).toHaveText('null')
})

test('marks an out-of-range date without discarding it', async ({ page }) => {
  const section = page.locator('[data-testid="range"]')
  await section.locator('[data-rx-date-segment="day"]').click()
  await page.keyboard.type('15031999')
  await expect(section.locator('[data-rx-date-root]')).toHaveAttribute('data-out-of-range', '')
  await expect(page.getByTestId('range-value')).toHaveText('1999-03-15')
})

test('accepts a date inside the range without marking it', async ({ page }) => {
  const section = page.locator('[data-testid="range"]')
  await section.locator('[data-rx-date-segment="day"]').click()
  await page.keyboard.type('15032026')
  await expect(section.locator('[data-rx-date-root]')).not.toHaveAttribute('data-out-of-range', '')
})

test('strips the diagnostics path from a production build', async ({ page }) => {
  // The demo is a *production* Vite build, so `process.env.NODE_ENV` folds to
  // "production" and the whole `onWarn` branch — and `warn.ts` with it — is
  // dropped by the bundler. The demo deliberately passes "03/01/2026"; an
  // empty list here is the evidence that the stripping works. The dev-mode
  // behaviour of the same field is covered in dev.browser.test.tsx.
  await expect(page.getByTestId('warning-codes')).toBeEmpty()
  // And the field still renders, empty, rather than crashing on the bad prop.
  await expect(page.locator('[data-testid="warnings"] [data-rx-date-segment="day"]')).toHaveText(
    'dd',
  )
})

test('posts the ISO value through a native form submit', async ({ page }) => {
  await page.locator('[data-testid="native-form"]').getByRole('button', { name: 'Save' }).click()
  await expect(page.getByTestId('submitted')).toHaveText('2026-03-15')
})

test('a disabled field is out of the tab order and refuses input', async ({ page }) => {
  const day = page.locator('[data-testid="state-disabled"] [data-rx-date-segment="day"]')
  await expect(day).toHaveAttribute('tabindex', '-1')
  await day.click({ force: true })
  await page.keyboard.type('27')
  await expect(day).toHaveText('15')
})

test('a read-only field is focusable but refuses input', async ({ page }) => {
  const day = page.locator('[data-testid="state-readonly"] [data-rx-date-segment="day"]')
  await expect(day).toHaveAttribute('tabindex', '0')
  await day.click()
  await page.keyboard.press('ArrowUp')
  await expect(day).toHaveText('15')
})

test('every id on the page is unique across instances', async ({ page }) => {
  const ids = await page.locator('[id]').evaluateAll((elements) => elements.map((el) => el.id))
  expect(new Set(ids).size).toBe(ids.length)
})
