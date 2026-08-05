import { expect, test } from '@playwright/test'

/**
 * Runs on Chromium, Firefox and WebKit. Two things here genuinely diverge
 * between engines: how a native `<select>` behaves under keyboard and pointer
 * driving, and how `setSelectionRange` interacts with a value React has just
 * rewritten — which is exactly what the as-you-type caret restore does on every
 * keystroke.
 *
 * Anything needing a whole page also belongs here: tab order across a form, ids
 * unique across instances, a native submit round-trip.
 */
test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Phone input' })).toBeVisible()
})

test('formats a national number as it is typed, in every engine', async ({ page }) => {
  const box = page.locator('[data-testid="basic"] [data-rx-phone-input]')
  await box.click()
  await page.keyboard.type('4155552671')
  await expect(box).toHaveValue('415 555 2671')
})

test('keeps the caret at the end while typing, in every engine', async ({ page }) => {
  // A naive reformat puts the caret before the separator it just inserted, and
  // the next keystroke lands in the wrong group.
  const box = page.locator('[data-testid="basic"] [data-rx-phone-input]')
  await box.click()
  await page.keyboard.type('41555')
  const caret = await box.evaluate((element: HTMLInputElement) => ({
    start: element.selectionStart,
    length: element.value.length,
  }))
  expect(caret.start).toBe(caret.length)
})

test('reports E.164 with the country and possibility', async ({ page }) => {
  const box = page.locator('[data-testid="details"] [data-rx-phone-input]')
  await box.click()
  await page.keyboard.type('2071234567')
  await expect(page.getByTestId('e164')).toHaveText('+442071234567')
  await expect(page.getByTestId('country')).toHaveText('GB')
  await expect(page.getByTestId('possible')).toHaveText('true')
})

test('marks a number that is not a possible length', async ({ page }) => {
  const box = page.locator('[data-testid="details"] [data-rx-phone-input]')
  await box.click()
  await page.keyboard.type('20712')
  await expect(page.getByTestId('possible')).toHaveText('false')
})

test('switches country when an explicit calling code is typed', async ({ page }) => {
  const section = page.locator('[data-testid="details"]')
  const box = section.locator('[data-rx-phone-input]')
  await box.click()
  await page.keyboard.type('+33612345678')
  await expect(section.locator('[data-rx-phone-country]')).toHaveValue('FR')
  await expect(page.getByTestId('e164')).toHaveText('+33612345678')
})

test('changing country through the select keeps the digits', async ({ page }) => {
  const section = page.locator('[data-testid="details"]')
  await section.locator('[data-rx-phone-input]').click()
  await page.keyboard.type('2071234567')
  await section.locator('[data-rx-phone-country]').selectOption('IE')
  await expect(page.getByTestId('e164')).toHaveText('+3532071234567')
})

test('the restricted picker lists exactly what it was given', async ({ page }) => {
  const options = await page
    .locator('[data-testid="restricted"] [data-rx-phone-country] option')
    .evaluateAll((elements) => elements.map((element) => (element as HTMLOptionElement).value))
  expect(options).toEqual(['GB', 'IE', 'FR', 'DE', 'ES'])
})

test('country names are localised by Intl, not by a bundled table', async ({ page }) => {
  const text = await page
    .locator('[data-testid="locale"] [data-rx-phone-country] option')
    .first()
    .textContent()
  expect(text).toContain('France')
  const german = await page
    .locator('[data-testid="locale"] [data-rx-phone-country] option')
    .nth(1)
    .textContent()
  // In French, Germany is "Allemagne" — proof the names came from the platform.
  expect(german).toContain('Allemagne')
})

test('flags render as emoji rather than as broken images', async ({ page }) => {
  const text = await page
    .locator('[data-testid="restricted"] [data-rx-phone-country] option')
    .first()
    .textContent()
  // Two regional-indicator symbols. On Windows these show as "GB", which is a
  // legible fallback; either way there is no image to fail to load.
  expect(text).toMatch(/[\u{1F1E6}-\u{1F1FF}]{2}|GB/u)
})

test('works without a country select when the number carries its own code', async ({ page }) => {
  const section = page.locator('[data-testid="no-select"]')
  await expect(section.locator('[data-rx-phone-country]')).toHaveCount(0)
  await expect(section.locator('[data-rx-phone-input]')).toHaveValue('+44 2071 234567')
})

test('strips the diagnostics path from a production build', async ({ page }) => {
  // The demo is a *production* Vite build, so `process.env.NODE_ENV` folds to
  // "production" and the whole `onWarn` branch — and `warn.ts` with it — is
  // dropped by the bundler. The demo deliberately passes `defaultCountry="ZZ"`;
  // an empty list here is the evidence that the stripping works. The dev-mode
  // behaviour of the same field is covered in dev.browser.test.tsx.
  await expect(page.getByTestId('warning-codes')).toBeEmpty()
  // And the field still works despite the bad prop.
  const box = page.locator('[data-testid="warnings"] [data-rx-phone-input]')
  await box.click()
  await page.keyboard.type('4155552671')
  await expect(box).toHaveValue('415 555 2671')
})

test('posts E.164 through a native form submit', async ({ page }) => {
  // The box shows grouped national digits; the form must get the canonical value.
  await expect(page.locator('[data-testid="native-form"] [data-rx-phone-input]')).toHaveValue(
    '+1 415 555 2671',
  )
  await page.locator('[data-testid="native-form"]').getByRole('button', { name: 'Save' }).click()
  await expect(page.getByTestId('submitted')).toHaveText('+14155552671')
})

test('a disabled field takes no input and its select is locked', async ({ page }) => {
  const section = page.locator('[data-testid="state-disabled"]')
  await expect(section.locator('[data-rx-phone-input]')).toBeDisabled()
  await expect(section.locator('[data-rx-phone-country]')).toBeDisabled()
})

test('a read-only field locks its select too', async ({ page }) => {
  // Otherwise the value could change without the number changing.
  const section = page.locator('[data-testid="state-readonly"]')
  await expect(section.locator('[data-rx-phone-input]')).toHaveAttribute('readonly', '')
  await expect(section.locator('[data-rx-phone-country]')).toBeDisabled()
})

test('every field is reachable by keyboard, select before number', async ({ page }) => {
  const section = page.locator('[data-testid="basic"]')
  await section.locator('[data-rx-phone-country]').focus()
  await page.keyboard.press('Tab')
  await expect(section.locator('[data-rx-phone-input]')).toBeFocused()
})

test('every id on the page is unique across instances', async ({ page }) => {
  const ids = await page.locator('[id]').evaluateAll((elements) => elements.map((el) => el.id))
  expect(new Set(ids).size).toBe(ids.length)
})

test('type-ahead in the country select jumps by country name', async ({ page }) => {
  // The option text has to start with the name for this to work at all: a
  // native select matches type-ahead from the first character, and a leading
  // flag emoji is a regional-indicator pair, not the letter "F".
  const country = page.locator('[data-testid="basic"] [data-rx-phone-country]')

  // The precondition is the part this package controls, and it is asserted
  // unconditionally: every option's text must begin with the country name.
  const leading = await country.evaluate((element) =>
    Array.from((element as HTMLSelectElement).options)
      .slice(0, 40)
      .map((option) => option.text.slice(0, 1)),
  )
  for (const character of leading) expect(character).toMatch(/[\p{L}\p{N}]/u)

  const france = await country.evaluate(
    (element) =>
      Array.from((element as HTMLSelectElement).options).find((o) => o.value === 'FR')?.text,
  )
  expect(france?.startsWith('France')).toBe(true)

  // The keystroke itself is the browser's own behaviour, and headless builds do
  // not always implement the select's type-ahead. Reported, never passed
  // silently: a skip here says the assertion did not run.
  await country.focus()
  await page.keyboard.press('f')
  const moved = await country.inputValue()
  test.skip(moved === 'US', 'this engine does not implement select type-ahead headlessly')
  expect(moved).toMatch(/^F/)
})

test('reports whether the number is a length the country uses', async ({ page }) => {
  const field = page.locator('[data-testid="validity"] [data-rx-phone-input]')
  await field.click()
  await page.keyboard.type('415')
  // Nothing while typing — every number is too short mid-entry.
  await expect(page.locator('[data-testid="validity"] [data-rx-phone-validity]')).toHaveCount(0)

  await page.locator('[data-testid="basic"] [data-rx-phone-input]').click()
  await expect(page.locator('[data-testid="validity"] [data-rx-phone-validity]')).toContainText(
    'not a length used by United States numbers',
  )

  await field.click()
  await page.keyboard.type('5552671')
  await page.locator('[data-testid="basic"] [data-rx-phone-input]').click()
  const note = page.locator('[data-testid="validity"] [data-rx-phone-validity]')
  await expect(note).toHaveAttribute('data-possible', '')
  await expect(note).toContainText('United States')
})
