import { expect, test } from '@playwright/test'

/**
 * Runs on Chromium, Firefox and WebKit — and for this component that is not a
 * formality. Whether a locale is 12- or 24-hour, and where the day period sits,
 * comes entirely from ICU, and the three engines ship three different ICU
 * builds. Anything needing a whole page (tab order across a form, ids unique
 * across instances, a native submit round-trip) also belongs here.
 */
const seg = (section: string, type: string) =>
  `[data-testid="${section}"] [data-rx-time-segment="${type}"]`

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Time input' })).toBeVisible()
})

test('picks the clock from the locale, in every engine', async ({ page }) => {
  // en-US is 12-hour with a trailing day period; en-GB is 24-hour with none.
  await expect(page.locator(seg('clock-us', 'dayPeriod'))).toHaveCount(1)
  await expect(page.locator(seg('clock-us', 'hour'))).toHaveText('02')
  await expect(page.locator(seg('clock-gb', 'dayPeriod'))).toHaveCount(0)
  await expect(page.locator(seg('clock-gb', 'hour'))).toHaveText('14')
})

test('honours an explicit hour12 override', async ({ page }) => {
  await expect(page.locator(seg('clock-ja', 'dayPeriod'))).toHaveCount(1)
  await expect(page.locator(seg('clock-ja', 'hour'))).toHaveText('02')
})

test('never starts or ends with a separator, in any locale', async ({ page }) => {
  for (const section of ['clock-us', 'clock-gb', 'clock-ja']) {
    const kinds = await page
      .locator(`[data-testid="${section}"] [data-rx-time-root] > span`)
      .evaluateAll((elements) =>
        elements.map((el) => (el.hasAttribute('data-rx-time-segment') ? 'segment' : 'literal')),
      )
    expect(kinds.at(0)).toBe('segment')
    expect(kinds.at(-1)).toBe('segment')
  }
})

test('fills a time by typing, with auto-advance', async ({ page }) => {
  await page.locator(seg('controlled', 'hour')).click()
  await page.keyboard.type('1145')
  await expect(page.locator(seg('controlled', 'hour'))).toHaveText('11')
  await expect(page.locator(seg('controlled', 'minute'))).toHaveText('45')
  await expect(page.getByTestId('value')).toHaveText('11:45')
})

test('the day period takes a and p, and moves the stored hour', async ({ page }) => {
  await page.locator(seg('controlled', 'dayPeriod')).click()
  await page.keyboard.press('p')
  // The field shows 09:30 PM; the canonical value is 21:30.
  await expect(page.getByTestId('value')).toHaveText('21:30')
  await page.keyboard.press('a')
  await expect(page.getByTestId('value')).toHaveText('09:30')
})

test('midnight and noon survive a round trip', async ({ page }) => {
  await page.getByRole('button', { name: 'Midnight' }).click()
  await expect(page.locator(seg('controlled', 'hour'))).toHaveText('12')
  await expect(page.locator(seg('controlled', 'dayPeriod'))).toHaveText('AM')
  await expect(page.getByTestId('value')).toHaveText('00:00')

  await page.getByRole('button', { name: 'Noon' }).click()
  await expect(page.locator(seg('controlled', 'hour'))).toHaveText('12')
  await expect(page.locator(seg('controlled', 'dayPeriod'))).toHaveText('PM')
  await expect(page.getByTestId('value')).toHaveText('12:00')
})

test('steps and wraps with the arrow keys', async ({ page }) => {
  const minute = page.locator(seg('controlled', 'minute'))
  await minute.click()
  await page.keyboard.press('ArrowUp')
  await expect(minute).toHaveText('31')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowDown')
  await expect(minute).toHaveText('29')
})

test('honours a minute step', async ({ page }) => {
  const minute = page.locator(seg('seconds', 'minute'))
  await minute.click()
  await page.keyboard.press('ArrowUp')
  await expect(minute).toHaveText('15')
})

test('gives each segment its own tab stop', async ({ page }) => {
  await page.locator(seg('controlled', 'hour')).click()
  await page.keyboard.press('Tab')
  await expect(page.locator(seg('controlled', 'minute'))).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.locator(seg('controlled', 'dayPeriod'))).toBeFocused()
})

test('clears a segment with Backspace', async ({ page }) => {
  await page.locator(seg('controlled', 'minute')).click()
  await page.keyboard.press('Backspace')
  await expect(page.locator(seg('controlled', 'minute'))).toHaveText('mm')
  await expect(page.getByTestId('value')).toHaveText('null')
})

test('marks an out-of-range time without discarding it', async ({ page }) => {
  await page.locator(seg('range', 'hour')).click()
  await page.keyboard.type('2030')
  await expect(page.locator('[data-testid="range"] [data-rx-time-root]')).toHaveAttribute(
    'data-out-of-range',
    '',
  )
  await expect(page.getByTestId('range-value')).toHaveText('20:30')
})

test('accepts a time inside the range without marking it', async ({ page }) => {
  await page.locator(seg('range', 'hour')).click()
  await page.keyboard.type('1030')
  await expect(page.locator('[data-testid="range"] [data-rx-time-root]')).not.toHaveAttribute(
    'data-out-of-range',
    '',
  )
})

test('strips the diagnostics path from a production build', async ({ page }) => {
  // The demo is a *production* Vite build, so `process.env.NODE_ENV` folds to
  // "production" and the whole `onWarn` branch — and `warn.ts` with it — is
  // dropped by the bundler. The demo deliberately passes "2:30 PM"; an empty
  // list here is the evidence that the stripping works.
  await expect(page.getByTestId('warning-codes')).toBeEmpty()
  await expect(page.locator(seg('warnings', 'hour'))).toHaveText('hh')
})

test('posts the 24-hour value through a native form submit', async ({ page }) => {
  // The field shows 02:30 PM; the form must receive 14:30.
  await page.locator('[data-testid="native-form"]').getByRole('button', { name: 'Save' }).click()
  await expect(page.getByTestId('submitted')).toHaveText('14:30')
})

test('a disabled field is out of the tab order and refuses input', async ({ page }) => {
  const hour = page.locator(seg('state-disabled', 'hour'))
  await expect(hour).toHaveAttribute('tabindex', '-1')
  await hour.click({ force: true })
  await page.keyboard.type('11')
  await expect(hour).toHaveText('09')
})

test('a read-only field is focusable but refuses input', async ({ page }) => {
  const hour = page.locator(seg('state-readonly', 'hour'))
  await expect(hour).toHaveAttribute('tabindex', '0')
  await hour.click()
  await page.keyboard.press('ArrowUp')
  await expect(hour).toHaveText('09')
})

test('every id on the page is unique across instances', async ({ page }) => {
  const ids = await page.locator('[id]').evaluateAll((els) => els.map((el) => el.id))
  expect(new Set(ids).size).toBe(ids.length)
})
