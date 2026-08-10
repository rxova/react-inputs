import { expect, test } from '@playwright/test'

/**
 * Against the package's own built demo, in all three engines.
 *
 * The engine matters here more than it looks: every unit suffix and every
 * segment name this field renders comes from `Intl.NumberFormat` with
 * `style: 'unit'`, and Chromium, Firefox and WebKit ship three different ICU
 * builds. "Does `en-GB` really write `st` for a stone here" is a question only
 * a real run in each engine can answer.
 */

const seg = (unit: string) => `[data-rx-measurement-segment="${unit}"]`

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('shows metres and centimetres by default', async ({ page }) => {
  const field = page.getByTestId('basic').locator('[data-rx-measurement-root]')
  await expect(field.locator('[data-rx-measurement-segment]')).toHaveCount(2)
  await expect(field.locator(seg('meter'))).toBeVisible()
})

test('takes a measurement from the keyboard alone', async ({ page }) => {
  const form = page.getByTestId('native-form')
  await form.locator(seg('foot')).click()
  await page.keyboard.press('Backspace')
  // Two digits per segment: width is the only thing that ends a number here.
  await page.keyboard.type('06')
  await page.keyboard.type('02')
  await form.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByTestId('submitted')).toHaveText('74 inch')
})

test('posts the amount and its unit as one string, not a bare number', async ({ page }) => {
  await page.getByTestId('native-form').getByRole('button', { name: 'Save' }).click()
  await expect(page.getByTestId('submitted')).toHaveText('71 inch')
})

/**
 * The behaviour that separates this from a pair of number inputs: 14 is a
 * legitimate thing to type into inches, and it settles into 1 ft 2 in rather
 * than being refused at the keystroke.
 */
test('carries 14 inches into a foot and two when focus leaves', async ({ page }) => {
  const field = page.getByTestId('carry')
  await field.locator(seg('inch')).click()
  await page.keyboard.type('14')
  await expect(field.locator(seg('inch'))).toHaveText('14')

  await page.getByRole('heading', { name: 'Measurement input' }).click()
  await expect(field.locator(seg('foot'))).toHaveText('1')
  await expect(field.locator(seg('inch'))).toHaveText('02')
})

test('lets a single-unit field hold a number no bounded segment would', async ({ page }) => {
  await expect(page.getByTestId('units-single').locator(seg('centimeter'))).toHaveText('180')
})

/** The conversion, end to end: one value, two unit systems on screen. */
test('converts a value written in a unit the field does not show', async ({ page }) => {
  const field = page.getByTestId('controlled')
  await expect(field.locator(seg('foot'))).toHaveText('5')
  await expect(field.locator(seg('inch'))).toHaveText('11')
  await field.getByRole('button', { name: 'As metres' }).click()
  // 1.8034 m is exactly 71 inches, so nothing on screen moves.
  await expect(field.locator(seg('foot'))).toHaveText('5')
  await expect(field.locator(seg('inch'))).toHaveText('11')
  // And the parent still holds what it set. The field renders a metric value
  // as feet and inches without rewriting it — a controlled value is the
  // parent's, and the same measurement in another unit is not a change.
  await expect(page.getByTestId('value')).toHaveText('1.8034 meter')
})

test('reports the same measurement in its base unit and orders it correctly', async ({ page }) => {
  await expect(page.getByTestId('value-base')).toHaveText('1.8034')
  // Equal, even though the two strings are not.
  await expect(page.getByTestId('value-compare')).toHaveText('0')
})

test('splits and rejoins a mass without drifting', async ({ page }) => {
  const field = page.getByTestId('units-mass')
  await expect(field.locator(seg('stone'))).toHaveText('12')
  await expect(field.locator(seg('pound'))).toHaveText('02')
})

test('writes a temperature with a decimal and a sign', async ({ page }) => {
  const field = page.getByTestId('temp-c')
  await expect(field.locator(seg('celsius'))).toHaveText('36.6')
  await field.locator(seg('celsius')).click()
  await page.keyboard.press('Backspace')
  await page.keyboard.type('-5.5')
  await expect(field.locator(seg('celsius'))).toHaveText('-5.5')
})

test('never shows a second temperature segment', async ({ page }) => {
  // `3 °C 20 °F` is two temperatures, not one.
  await expect(page.getByTestId('temp-c').locator('[data-rx-measurement-segment]')).toHaveCount(1)
  await expect(page.getByTestId('temp-f').locator('[data-rx-measurement-segment]')).toHaveCount(1)
})

test('collapses a pair with no whole-number ratio to a single segment', async ({ page }) => {
  // `units={['meter', 'inch']}` — a metre is 39.37 inches, so the inches
  // segment would have no ceiling to carry at.
  await expect(page.getByTestId('warnings').locator('[data-rx-measurement-segment]')).toHaveCount(1)
})

test('steps by the step prop and clamps at the segment ends', async ({ page }) => {
  const field = page.getByTestId('steps')
  await field.locator(seg('gram')).click()
  await page.keyboard.press('ArrowUp')
  await expect(field.locator(seg('gram'))).toHaveText('550')
  await page.keyboard.press('End')
  await expect(field.locator(seg('gram'))).toHaveText('999')
  await page.keyboard.press('ArrowUp')
  // Clamped: rolling round would silently add a kilogram.
  await expect(field.locator(seg('gram'))).toHaveText('999')
})

test('marks a measurement outside the range without discarding it', async ({ page }) => {
  const field = page.getByTestId('range')
  await field.locator(seg('foot')).click()
  await page.keyboard.type('0300')
  await expect(page.getByTestId('range-value')).toHaveText('36 inch')
  await expect(field.locator('[data-rx-measurement-root]')).toHaveAttribute('data-out-of-range', '')
})

test('honours a bound written in a unit the field does not show', async ({ page }) => {
  const field = page.getByTestId('range')
  await field.locator(seg('foot')).click()
  // 5 ft 11 in, comfortably inside min="1.4 meter" max="2.1 meter".
  await page.keyboard.type('0511')
  await expect(field.locator('[data-rx-measurement-root]')).not.toHaveAttribute(
    'data-out-of-range',
    '',
  )
})

test('takes its suffixes from the engine ICU, per locale', async ({ page }) => {
  await expect(page.getByTestId('locale-en')).toContainText('ft')
  await expect(page.getByTestId('locale-de')).toContainText('ft')
  await expect(page.getByTestId('locale-fr')).toContainText('cm')
})

/**
 * The demo is built in production mode, where the whole diagnostics path is
 * compiled out. An empty list is the assertion — it proves the stripping works,
 * which a message-matching test never could.
 */
test('ships no diagnostics in a production build', async ({ page }) => {
  await expect(page.getByTestId('warning-codes').locator('li')).toHaveCount(0)
})

test('refuses every edit while disabled and read-only', async ({ page }) => {
  const disabled = page.getByTestId('state-disabled').locator(seg('inch'))
  await expect(disabled).toHaveAttribute('tabindex', '-1')

  const readOnly = page.getByTestId('state-readonly').locator(seg('inch'))
  await readOnly.click()
  await page.keyboard.type('05')
  await expect(readOnly).toHaveText('11')
})
