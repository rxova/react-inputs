import { expect, test } from '@playwright/test'

/**
 * Runs on Chromium, Firefox and WebKit. The engine-specific behaviour this
 * component depends on is exactly the kind that diverges: swapping a live
 * input's `type` without losing focus or the caret, and how each engine treats
 * a mousedown whose default was prevented.
 *
 * Anything that needs a whole page rather than a mounted component belongs
 * here — tab order across a real form, ids being unique across several
 * instances, a native submit round-trip.
 */
test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Password input' })).toBeVisible()
})

test('masks by default and reveals on demand, in every engine', async ({ page }) => {
  const field = page.locator('[data-testid="basic"] [data-rpi-input]')
  await field.fill('hunter2')
  await expect(field).toHaveAttribute('type', 'password')

  await page.locator('[data-testid="basic"]').getByRole('button', { name: 'Show password' }).click()
  await expect(field).toHaveAttribute('type', 'text')
  // The value survives the swap — a re-created editor that dropped it would be
  // a silent data-loss bug.
  await expect(field).toHaveValue('hunter2')

  await page.locator('[data-testid="basic"]').getByRole('button', { name: 'Hide password' }).click()
  await expect(field).toHaveAttribute('type', 'password')
})

test('keeps the caret in place across the reveal, in every engine', async ({ page }) => {
  const section = page.locator('[data-testid="basic"]')
  const field = section.locator('[data-rpi-input]')
  await field.fill('abcdef')
  await field.evaluate((element: HTMLInputElement) => {
    element.focus()
    element.setSelectionRange(2, 4)
  })

  await section.getByRole('button', { name: 'Show password' }).click()

  const selection = await field.evaluate((element: HTMLInputElement) => ({
    start: element.selectionStart,
    end: element.selectionEnd,
    focused: document.activeElement === element,
  }))
  expect(selection).toEqual({ start: 2, end: 4, focused: true })
})

test('re-masks when focus leaves the field', async ({ page }) => {
  const section = page.locator('[data-testid="basic"]')
  const field = section.locator('[data-rpi-input]')
  await field.fill('hunter2')
  await section.getByRole('button', { name: 'Show password' }).click()
  await expect(field).toHaveAttribute('type', 'text')

  await page.locator('[data-testid="caps"] [data-rpi-input]').click()
  await expect(field).toHaveAttribute('type', 'password')
})

test('the reveal toggle is reachable and operable by keyboard alone', async ({ page }) => {
  const section = page.locator('[data-testid="basic"]')
  const field = section.locator('[data-rpi-input]')
  await field.click()
  await page.keyboard.type('hunter2')
  await page.keyboard.press('Tab')

  await expect(section.getByRole('button', { name: 'Show password' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(field).toHaveAttribute('type', 'text')
})

test('the strength meter and checklist track what is typed', async ({ page }) => {
  const section = page.locator('[data-testid="strength"]')
  const field = section.locator('[data-rpi-input]')

  await field.fill('password')
  await expect(section.locator('[data-rpi-meter]')).toHaveAttribute('aria-valuenow', '0')
  await expect(page.getByTestId('validity')).toHaveText('Not yet')

  await field.fill('Kq7#mVx2Lp!wZ')
  await expect(section.locator('[data-rule="digit"]')).toHaveAttribute('data-met', '')
  await expect(page.getByTestId('validity')).toHaveText('Ready to submit')
})

test('an optional rule never blocks validity', async ({ page }) => {
  const section = page.locator('[data-testid="strength"]')
  // No symbol, so the optional rule fails — validity must still be reached.
  await section.locator('[data-rpi-input]').fill('Kq7mVx2LpwZ9')
  await expect(section.locator('[data-rule="symbol"]')).not.toHaveAttribute('data-met', '')
  await expect(page.getByTestId('validity')).toHaveText('Ready to submit')
})

test('the breach check reports a known-compromised password', async ({ page }) => {
  const section = page.locator('[data-testid="breach"]')
  await section.locator('[data-rpi-input]').fill('hunter2')
  await expect(section.getByRole('alert')).toContainText('data breach')

  await section.locator('[data-rpi-input]').fill('Kq7#mVx2Lp!wZ')
  await expect(section.locator('[data-rpi-compromised]')).toHaveCount(0)
})

test('strips the diagnostics path from a production build', async ({ page }) => {
  // The demo is a *production* Vite build, so `process.env.NODE_ENV` folds to
  // "production" and the whole `onWarn` branch — and `warn.ts` with it — is
  // dropped by the bundler. The demo deliberately misconfigures `minLength`
  // to -3; seeing no warning here is the evidence that the stripping works.
  // The dev-mode behaviour of the same field is covered in dev.browser.test.tsx.
  await expect(page.getByTestId('warning-codes')).toBeEmpty()
  // And the field still renders and works despite the bad prop.
  const field = page.locator('input[name="warned"]')
  await field.fill('anything')
  await expect(field).toHaveValue('anything')
})

test('posts through a native form submit', async ({ page }) => {
  await page.locator('[data-testid="native-form"]').getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByTestId('submitted')).toHaveText('hunter2')
})

test('a disabled field takes neither focus nor input', async ({ page }) => {
  const field = page.locator('[data-testid="states"] input[name="disabled"]')
  await expect(field).toBeDisabled()
  await expect(
    page.locator('[data-testid="states"]').getByRole('button', { name: 'Show password' }).first(),
  ).toBeDisabled()
})

test('a read-only field still reveals', async ({ page }) => {
  const section = page.locator('[data-testid="states"]')
  const field = section.locator('input[name="readonly"]')
  await section.getByRole('button', { name: 'Show password' }).nth(1).click()
  await expect(field).toHaveAttribute('type', 'text')
})

test('every id on the page is unique across instances', async ({ page }) => {
  // Seven fields share one page. A hard-coded id anywhere would make
  // `aria-describedby` and `<label for>` point at the wrong instance.
  const ids = await page.locator('[id]').evaluateAll((elements) => elements.map((el) => el.id))
  expect(new Set(ids).size).toBe(ids.length)
})

test('every password field is reachable in a sensible tab order', async ({ page }) => {
  await page.locator('[data-testid="basic"] [data-rpi-input]').click()
  const order: string[] = []
  for (let step = 0; step < 4; step++) {
    order.push(
      await page.evaluate(() => {
        const active = document.activeElement
        return active?.getAttribute('data-rpi-input') !== null
          ? 'input'
          : active?.getAttribute('data-rpi-toggle') !== null
            ? 'toggle'
            : (active?.tagName.toLowerCase() ?? 'none')
      }),
    )
    await page.keyboard.press('Tab')
  }
  // Input, then its own toggle, then the next field's input — never the toggle
  // before the field it belongs to.
  expect(order.slice(0, 2)).toEqual(['input', 'toggle'])
})
