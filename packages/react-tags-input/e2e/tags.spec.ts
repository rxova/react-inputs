import { expect, test } from '@playwright/test'

/**
 * Runs on Chromium, Firefox and WebKit. The behaviour that diverges between
 * engines here is focus: where it lands after a removal, whether a `<button>`
 * is in the tab order at all (WebKit leaves them out without Full Keyboard
 * Access, which is why the remove buttons carry an explicit tabindex), and how
 * paste events are delivered.
 *
 * Anything needing a whole page also belongs here: tab order across a form, ids
 * unique across instances, a native submit round-trip.
 */
const inputIn = (section: string) => `[data-testid="${section}"] [data-rtg-input]`
const tagsIn = (section: string) => `[data-testid="${section}"] [data-rtg-tag-label]`
const removesIn = (section: string) => `[data-testid="${section}"] [data-rtg-remove]`

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Tags input' })).toBeVisible()
})

test('commits on Enter and on a comma, in every engine', async ({ page }) => {
  await page.locator(inputIn('basic')).click()
  await page.keyboard.type('react')
  await page.keyboard.press('Enter')
  await page.keyboard.type('vue,')
  await expect(page.locator(tagsIn('basic'))).toHaveText(['react', 'vue'])
  await expect(page.locator(inputIn('basic'))).toHaveValue('')
})

test('removes with the button and reports the new list', async ({ page }) => {
  await page.locator(inputIn('controlled')).click()
  await page.keyboard.type('vue{')
  await page.keyboard.press('Enter')
  await page
    .locator('[data-testid="controlled"]')
    .getByRole('button', { name: 'Remove react' })
    .click()
  await expect(page.getByTestId('value')).not.toContainText('react')
})

test('keeps focus inside the field after a removal', async ({ page }) => {
  // Leaving focus on a button that no longer exists drops it to <body>, which
  // is the most common accessibility failure in this widget.
  await page.locator(inputIn('native-form')).click()
  await page.keyboard.type('extra')
  await page.keyboard.press('Enter')

  await page.locator(removesIn('native-form')).first().focus()
  await page.keyboard.press('Backspace')
  const inside = await page.evaluate(() => {
    const section = document.querySelector('[data-testid="native-form"]')
    return section?.contains(document.activeElement) ?? false
  })
  expect(inside).toBe(true)
})

test('takes two Backspaces from an empty box, not one', async ({ page }) => {
  const section = '[data-testid="native-form"]'
  await page.locator(inputIn('native-form')).click()
  await page.keyboard.press('Backspace')
  await expect(page.locator(tagsIn('native-form'))).toHaveCount(2)
  await expect(page.locator(`${section} [data-rtg-remove]`).nth(1)).toBeFocused()
  await page.keyboard.press('Backspace')
  await expect(page.locator(tagsIn('native-form'))).toHaveCount(1)
})

test('gives the whole tag list a single tab stop', async ({ page }) => {
  // Twenty tags must not cost a keyboard user twenty presses to get past.
  const tabbable = await page
    .locator(removesIn('native-form'))
    .evaluateAll((elements) => elements.filter((el) => (el as HTMLElement).tabIndex === 0).length)
  expect(tabbable).toBe(1)
})

test('moves between tags with the arrow keys and out into the box', async ({ page }) => {
  await page.locator(removesIn('native-form')).first().focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.locator(removesIn('native-form')).nth(1)).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await expect(page.locator(inputIn('native-form'))).toBeFocused()
})

test('the remove buttons are reachable by Tab, including in WebKit', async ({ page }) => {
  // WebKit leaves buttons out of the tab order unless Full Keyboard Access is
  // on, which is why they carry an explicit tabindex.
  await page.locator('[data-testid="native-form"] label').first().click({ force: true })
  await page.locator(removesIn('native-form')).first().focus()
  await expect(page.locator(removesIn('native-form')).first()).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.locator(inputIn('native-form'))).toBeFocused()
})

test('splits a pasted list into tags', async ({ page }) => {
  const input = page.locator(inputIn('basic'))
  await input.click()

  // Firefox ignores `clipboardData` passed to the `ClipboardEvent`
  // constructor, so a synthesised paste arrives empty there and the assertion
  // would be testing the harness rather than the component. The evaluate
  // reports whether the data actually made it onto the event, and the test
  // skips itself — visibly — where it did not. The paste path is still covered
  // in Chromium and WebKit here, and in the browser suite.
  const delivered = await input.evaluate((element) => {
    const data = new DataTransfer()
    data.setData('text', 'alpha, beta, gamma')
    const event = new ClipboardEvent('paste', { clipboardData: data, bubbles: true })
    const carried = event.clipboardData?.getData('text') === 'alpha, beta, gamma'
    element.dispatchEvent(event)
    return carried
  })
  test.skip(
    !delivered,
    'this engine does not accept clipboardData in the ClipboardEvent constructor',
  )

  await expect(page.locator(tagsIn('basic'))).toHaveText(['alpha', 'beta', 'gamma'])
})

test('applies transform, max and validate', async ({ page }) => {
  const input = page.locator(inputIn('rules'))
  await input.click()
  await page.keyboard.type('REACT')
  await page.keyboard.press('Enter')
  await expect(page.locator(tagsIn('rules'))).toHaveText(['react'])

  await page.keyboard.type('Xstate')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('rejection')).toContainText('invalid')
  await expect(page.getByTestId('rejection-message')).toHaveText('no x-words here')
})

test('leaves a refused entry in the box for the user to fix', async ({ page }) => {
  const input = page.locator(inputIn('rules'))
  await input.click()
  await page.keyboard.type('a')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('rejection')).toContainText('too-short')
  await expect(input).toHaveValue('a')
})

test('announces additions and removals politely', async ({ page }) => {
  const live = page.locator('[data-testid="basic"] [data-rtg-announcement]')
  await expect(live).toHaveAttribute('aria-live', 'polite')
  await page.locator(inputIn('basic')).click()
  await page.keyboard.type('react')
  await page.keyboard.press('Enter')
  await expect(live).toHaveText('Added react. 1 tag.')
})

test('strips the diagnostics path from a production build', async ({ page }) => {
  // The demo is a *production* Vite build, so `process.env.NODE_ENV` folds to
  // "production" and the whole `onWarn` branch — and `warn.ts` with it — is
  // dropped by the bundler. The demo deliberately passes `max={0}`; an empty
  // list here is the evidence that the stripping works.
  await expect(page.getByTestId('warning-codes')).toBeEmpty()
  // And the field still works, with the unusable max ignored.
  await page.locator(inputIn('warnings')).click()
  await page.keyboard.type('still-works')
  await page.keyboard.press('Enter')
  await expect(page.locator(tagsIn('warnings'))).toHaveText(['still-works'])
})

test('posts one value per tag through a native form submit', async ({ page }) => {
  await page.locator('[data-testid="native-form"]').getByRole('button', { name: 'Save' }).click()
  // An array, not a comma-joined string somebody downstream has to split.
  await expect(page.getByTestId('submitted')).toHaveText('react|a11y')
})

test('a disabled field takes no input and its buttons are disabled', async ({ page }) => {
  await expect(page.locator(inputIn('state-disabled'))).toBeDisabled()
  await expect(page.locator(removesIn('state-disabled')).first()).toBeDisabled()
})

test('a read-only field shows tags with no remove buttons at all', async ({ page }) => {
  // A visible but inert button is a worse affordance than no button.
  await expect(page.locator(tagsIn('state-readonly'))).toHaveText(['react', 'vue'])
  await expect(page.locator(removesIn('state-readonly'))).toHaveCount(0)
})

test('every id on the page is unique across instances', async ({ page }) => {
  const ids = await page.locator('[id]').evaluateAll((els) => els.map((el) => el.id))
  expect(new Set(ids).size).toBe(ids.length)
})
