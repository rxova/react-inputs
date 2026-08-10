import { expect, test } from '@playwright/test'

/**
 * Against the package's own built demo, in all three engines.
 *
 * The engine matters more here than anywhere else in the suite. The zone list,
 * the localised names and — critically — *which spelling of a zone the engine
 * reports* all come from that engine's ICU build, and the three ship three
 * different ones. Whether this run sees `Europe/Kiev` or `Europe/Kyiv` is the
 * whole subject of `resolveZone`, so a Chromium-only run tests a third of it.
 */

const field = (testId: string) => `[data-testid="${testId}"] [data-rx-timezone-select]`

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Time zone input' })).toBeVisible()
})

test('offers every zone the platform knows, plus UTC', async ({ page }) => {
  const select = page.getByTestId('basic').locator('[data-rx-timezone-select]')
  const count = await select.locator('option').count()
  // 418 in this engine's ICU, plus UTC, plus the empty option. The exact number
  // moves with the ICU build, so the assertion is a floor rather than an equality.
  expect(count).toBeGreaterThan(400)
  await expect(select.locator('option[value="UTC"]')).toHaveCount(1)
})

/**
 * Problem 1, end to end: a picker built straight off `supportedValuesOf` cannot
 * select the most commonly stored zone in the world.
 */
test('UTC is selectable even though the platform does not list it', async ({ page }) => {
  const select = page.getByTestId('utc').locator('[data-rx-timezone-select]')
  await expect(select).toHaveValue('UTC')
  const listed = await page.evaluate(() => Intl.supportedValuesOf('timeZone').includes('UTC'))
  expect(listed).toBe(false)
})

/**
 * Problem 2, end to end and per engine. Whichever spelling this ICU lists, both
 * fields must land on the same zone and neither may be empty.
 */
test('a renamed zone selects the same option under either spelling', async ({ page }) => {
  const modern = page.getByTestId('renamed-modern').locator('[data-rx-timezone-select]')
  const legacy = page.getByTestId('renamed-legacy').locator('[data-rx-timezone-select]')
  const a = await modern.inputValue()
  const b = await legacy.inputValue()
  expect(a).not.toBe('')
  expect(b).not.toBe('')
  expect(a).toBe(b)
})

test('groups the options by area', async ({ page }) => {
  const groups = page.getByTestId('basic').locator('optgroup')
  expect(await groups.count()).toBeGreaterThan(5)
  await expect(groups.first()).toHaveAttribute('label', 'UTC')
})

test('selecting reports the IANA id, not an offset', async ({ page }) => {
  const select = page.getByTestId('controlled').locator('[data-rx-timezone-select]')
  await select.selectOption('Asia/Tokyo')
  await expect(page.getByTestId('value')).toHaveText('Asia/Tokyo')
  // The offset is derived beside it rather than stored.
  await expect(page.getByTestId('value-offset')).toHaveText('+09:00')
})

test('a controlled parent can write the value', async ({ page }) => {
  await page.getByTestId('controlled').getByRole('button', { name: 'Tokyo' }).click()
  await expect(page.getByTestId('controlled').locator('[data-rx-timezone-select]')).toHaveValue(
    'Asia/Tokyo',
  )
  await page.getByTestId('controlled').getByRole('button', { name: 'Clear' }).click()
  await expect(page.getByTestId('value')).toHaveText('null')
  await expect(page.getByTestId('controlled').locator('[data-rx-timezone-select]')).toHaveValue('')
})

test('can select the runtime own zone', async ({ page }) => {
  await page.getByTestId('controlled').getByRole('button', { name: 'Use my zone' }).click()
  const shown = await page.getByTestId('value').textContent()
  const local = await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)
  expect(shown).toBe(local)
})

/**
 * Problem 3: an offset is a fact about an instant. The same four zones,
 * relabelled by moving the reference date across the DST boundary.
 */
test('the offsets follow the reference date', async ({ page }) => {
  const section = page.getByTestId('reference')
  const select = section.locator('[data-rx-timezone-select]')

  await expect(page.getByTestId('reference-season')).toHaveText('January')
  await expect(select.locator('option[value="America/New_York"]')).toContainText('-05:00')
  await expect(select.locator('option[value="Australia/Sydney"]')).toContainText('+11:00')

  await section.getByRole('button', { name: 'Toggle season' }).click()
  await expect(page.getByTestId('reference-season')).toHaveText('July')
  await expect(select.locator('option[value="America/New_York"]')).toContainText('-04:00')
  await expect(select.locator('option[value="Australia/Sydney"]')).toContainText('+10:00')
})

test('the zone name does not change with the season, but the phase does', async ({ page }) => {
  const select = page.getByTestId('reference').locator('[data-rx-timezone-select]')
  const winter = await select.locator('option[value="America/New_York"]').textContent()
  await page.getByTestId('reference').getByRole('button', { name: 'Toggle season' }).click()
  const summer = await select.locator('option[value="America/New_York"]').textContent()
  // `longGeneric`, so "Eastern Time" both times — only the offset moved.
  expect(winter?.replace(/\(.*\)/, '')).toBe(summer?.replace(/\(.*\)/, ''))
  expect(winter).not.toBe(summer)
})

test('a shortlist shows only what it was given, plus UTC', async ({ page }) => {
  const options = page.getByTestId('narrow').locator('option')
  const values = await options.evaluateAll((nodes) =>
    nodes.map((node) => (node as HTMLOptionElement).value).filter(Boolean),
  )
  expect(new Set(values)).toEqual(
    new Set(['UTC', 'Europe/Madrid', 'America/New_York', 'Asia/Tokyo']),
  )
})

test('an ungrouped list has no optgroups', async ({ page }) => {
  await expect(page.getByTestId('flat').locator('optgroup')).toHaveCount(0)
  expect(await page.getByTestId('flat').locator('option').count()).toBeGreaterThan(400)
})

test('the select posts itself, with no hidden input', async ({ page }) => {
  await page.getByTestId('native-form').getByRole('button', { name: 'Save' }).click()
  await expect(page.getByTestId('submitted')).toHaveText('Europe/Madrid')
  await expect(page.getByTestId('native-form').locator('input[type="hidden"]')).toHaveCount(0)
})

test('a changed selection is what the form posts', async ({ page }) => {
  await page.locator(field('native-form')).selectOption('UTC')
  await page.getByTestId('native-form').getByRole('button', { name: 'Save' }).click()
  await expect(page.getByTestId('submitted')).toHaveText('UTC')
})

test('a disabled field refuses every edit', async ({ page }) => {
  await expect(page.locator(field('state-disabled'))).toBeDisabled()
})

/**
 * The demo is built in production mode, where the whole diagnostics path is
 * compiled out. An empty list is the assertion — it proves the stripping works,
 * which a message-matching test never could.
 */
test('ships no diagnostics in a production build', async ({ page }) => {
  await expect(page.getByTestId('warning-codes').locator('li')).toHaveCount(0)
})

test('never paints a zone it has not got', async ({ page }) => {
  // The misconfigured field is given `+02:00`, which is not a zone.
  await expect(page.locator(field('warnings'))).toHaveValue('')
})
