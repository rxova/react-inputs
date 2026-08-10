import { expect, test } from '@playwright/test'

/**
 * Against the package's own built demo, in all three engines.
 *
 * The engine matters here more than it looks: every unit suffix and every
 * segment name this field renders comes from `Intl.NumberFormat` with
 * `style: 'unit'`, and Chromium, Firefox and WebKit ship three different ICU
 * builds. "Does `de-DE` really write `Min.` here" is a question only a real run
 * in each engine can answer.
 */

const seg = (unit: string) => `[data-rx-duration-segment="${unit}"]`

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('shows hours and minutes by default', async ({ page }) => {
  const field = page.getByTestId('carry').locator('[data-rx-duration-root]')
  await expect(field.locator('[data-rx-duration-segment]')).toHaveCount(2)
})

test('takes a duration from the keyboard alone', async ({ page }) => {
  const form = page.getByTestId('native-form')
  await form.locator(seg('hour')).click()
  await page.keyboard.press('Backspace')
  await page.keyboard.type('2')
  await page.keyboard.type('15')
  await form.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByTestId('submitted')).toHaveText('PT2H15M')
})

test('posts the ISO duration, not a display string', async ({ page }) => {
  await page.getByTestId('native-form').getByRole('button', { name: 'Save' }).click()
  await expect(page.getByTestId('submitted')).toHaveText('PT1H30M')
})

/**
 * The behaviour that separates this from every duration field on npm: 90 is a
 * legitimate thing to type into minutes, and it settles into 1h 30m rather than
 * being refused at the keystroke.
 */
test('carries 90 minutes into an hour and a half when focus leaves', async ({ page }) => {
  const field = page.getByTestId('carry')
  await field.locator(seg('minute')).click()
  await page.keyboard.type('90')
  await expect(field.locator(seg('minute'))).toHaveText('90')

  await page.getByRole('heading', { name: 'Duration input' }).click()
  await expect(field.locator(seg('hour'))).toHaveText('1')
  await expect(field.locator(seg('minute'))).toHaveText('30')
})

test('lets a minutes-only field hold a number no other segment would', async ({ page }) => {
  const field = page.getByTestId('units-minutes')
  await expect(field.locator(seg('minute'))).toHaveText('90')
})

test('splits a value across whatever units are on screen', async ({ page }) => {
  const hms = page.getByTestId('units-hms')
  await expect(hms.locator(seg('hour'))).toHaveText('1')
  await expect(hms.locator(seg('minute'))).toHaveText('30')
  await expect(hms.locator(seg('second'))).toHaveText('15')

  const dh = page.getByTestId('units-dhm')
  await expect(dh.locator(seg('day'))).toHaveText('2')
  await expect(dh.locator(seg('hour'))).toHaveText('04')
})

test('takes its suffixes from the locale, in every engine', async ({ page }) => {
  await expect(page.getByTestId('locale-en')).toContainText('h')
  await expect(page.getByTestId('locale-de')).toContainText('Min.')
  await expect(page.getByTestId('locale-ja')).toContainText('分')
})

test('reports the value as ISO and exposes the seconds helper', async ({ page }) => {
  await expect(page.getByTestId('value')).toHaveText('PT1H30M')
  await expect(page.getByTestId('value-seconds')).toHaveText('5400')

  await page.getByRole('button', { name: '45 minutes' }).click()
  await expect(page.getByTestId('value')).toHaveText('PT45M')
  await expect(page.getByTestId('value-seconds')).toHaveText('2700')
})

test('empties on demand and refills from the keyboard', async ({ page }) => {
  const controlled = page.getByTestId('controlled')
  await controlled.getByRole('button', { name: 'Clear' }).click()
  await expect(page.getByTestId('value')).toHaveText('null')
  await expect(controlled.locator(seg('hour'))).toHaveText('hh')
})

test('walks the step grid it is given', async ({ page }) => {
  const steps = page.getByTestId('steps')
  await steps.locator(seg('minute')).click()
  await page.keyboard.press('ArrowUp')
  await expect(steps.locator(seg('minute'))).toHaveText('15')
  await page.keyboard.press('ArrowUp')
  await expect(steps.locator(seg('minute'))).toHaveText('30')
})

test('clamps rather than wrapping, because a duration has no cycle', async ({ page }) => {
  const steps = page.getByTestId('steps')
  await steps.locator(seg('minute')).click()
  await page.keyboard.press('Home')
  await expect(steps.locator(seg('minute'))).toHaveText('00')
  await page.keyboard.press('ArrowDown')
  await expect(steps.locator(seg('minute'))).toHaveText('00')
})

test('marks an out-of-range duration without discarding it', async ({ page }) => {
  const range = page.getByTestId('range')
  await range.locator(seg('hour')).click()
  await page.keyboard.type('5')
  await page.keyboard.type('00')
  await expect(page.getByTestId('range-value')).toHaveText('PT5H')
  await expect(range.locator('[data-rx-duration-root]')).toHaveAttribute('data-invalid', '')
})

test('names the month/minute trap through onWarn', async ({ page }) => {
  await expect(page.getByTestId('warning-codes')).toContainText('value-calendar-unit')
})

test('refuses every edit while disabled and while read-only', async ({ page }) => {
  const disabled = page.getByTestId('state-disabled')
  await expect(disabled.locator(seg('minute'))).toHaveAttribute('tabindex', '-1')

  const readOnly = page.getByTestId('state-readonly')
  await readOnly.locator(seg('minute')).click()
  await page.keyboard.press('ArrowUp')
  await expect(readOnly.locator(seg('minute'))).toHaveText('30')
})
