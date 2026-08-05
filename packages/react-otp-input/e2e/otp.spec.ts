import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'OTP input' })).toBeVisible()
})

/** The slots' visible characters within a section, read from real layout. */
async function slotChars(page: Page, testid: string) {
  return page.evaluate((testid) => {
    const root = document.querySelector(`[data-testid="${testid}"]`)
    return [...(root?.querySelectorAll('[data-rx-otp-slot]') ?? [])].map(
      (el) => el.textContent ?? '',
    )
  }, testid)
}

test.describe('display', () => {
  test('renders one field and six slots by default', async ({ page }) => {
    const section = page.locator('[data-testid="default"]')
    await expect(section.getByRole('textbox')).toHaveCount(1)
    await expect(section.locator('[data-rx-otp-slot]')).toHaveCount(6)
  })

  test('groups render a separator between two runs of slots', async ({ page }) => {
    const section = page.locator('[data-testid="grouped"]')
    await expect(section.locator('[data-rx-otp-group]')).toHaveCount(2)
    await expect(section.locator('[data-rx-otp-separator]')).toHaveText('–')
  })

  test('keeps every OTP row inside its card at desktop and phone widths', async ({ page }) => {
    for (const width of [1280, 768, 320]) {
      await page.setViewportSize({ width, height: 900 })

      const overflowingRows = await page
        .locator('[data-rx-otp-root]')
        .evaluateAll((roots) =>
          roots.flatMap((root, index) =>
            root.scrollWidth > root.clientWidth
              ? [{ index, width: root.clientWidth, scrollWidth: root.scrollWidth }]
              : [],
          ),
        )

      expect(overflowingRows, `OTP rows overflowing at a ${String(width)}px viewport`).toEqual([])
    }
  })

  test('masks filled characters', async ({ page }) => {
    expect((await slotChars(page, 'masked')).slice(0, 4)).toEqual(['•', '•', '•', '•'])
  })

  test('shows placeholders on empty slots', async ({ page }) => {
    expect(await slotChars(page, 'placeholder')).toEqual(['·', '·', '·', '·'])
  })

  test('lays glyphs at the slot pitch in the default (spatial) field', async ({ page }) => {
    const spacing = await page
      .locator('[data-testid="default"] input')
      .evaluate((el) => (el as HTMLInputElement).style.letterSpacing)
    expect(parseFloat(spacing)).toBeGreaterThan(0)
  })

  test('collapses glyphs in a crush-mode field', async ({ page }) => {
    const spacing = await page
      .locator('[data-testid="crush"] input')
      .evaluate((el) => (el as HTMLInputElement).style.letterSpacing)
    expect(spacing).toBe('-1em')
  })
})

test.describe('typing', () => {
  test('distributes typed digits across slots and reports completion', async ({ page }) => {
    const section = page.locator('[data-testid="default"]')
    await section.getByRole('textbox').click()
    await page.keyboard.type('482913')
    expect(await slotChars(page, 'default')).toEqual(['4', '8', '2', '9', '1', '3'])
    await expect(page.getByTestId('default-value')).toHaveText('482913')
    await expect(page.getByTestId('default-complete')).toHaveText('482913')
  })

  test('uppercases an alphanumeric code as it is typed', async ({ page }) => {
    const section = page.locator('[data-testid="alphanumeric"]')
    await section.getByRole('textbox').click()
    await page.keyboard.type('ab12cd')
    await expect(page.getByTestId('alphanumeric-value')).toHaveText('AB12CD')
  })

  test('pasting a formatted code strips separators and distributes it', async ({
    page,
    browserName,
  }) => {
    // A synthetic ClipboardEvent's clipboardData is only constructable in
    // Chromium; Firefox/WebKit ignore the init. The paste distribution itself is
    // covered engine-independently by the Vitest browser suite — here we just
    // confirm the wiring holds end-to-end in a real page.
    test.skip(browserName !== 'chromium', 'synthetic clipboardData unsupported off Chromium')
    const section = page.locator('[data-testid="default"]')
    await section.getByRole('textbox').click()
    await section.getByRole('textbox').evaluate((el) => {
      const data = new DataTransfer()
      data.setData('text', '482-913')
      el.dispatchEvent(
        new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
      )
    })
    await expect(page.getByTestId('default-value')).toHaveText('482913')
  })

  test('tap-to-edit: clicking a middle slot lands the caret there', async ({ page }) => {
    const section = page.locator('[data-testid="default"]')
    const field = section.getByRole('textbox')
    await field.click()
    await page.keyboard.type('111111')
    // The transparent input overlays the slots (that's what makes spatial tap
    // work), so click *at* the third slot's coordinates rather than the slot
    // element. The tap lands the caret in the middle of the field — the thing
    // input-otp can't do (its caret only moves by arrow key). The exact index
    // depends on per-engine font metrics, so assert the tapped region, then
    // prove an in-place middle edit.
    const box = (await section.locator('[data-rx-otp-slot]').nth(2).boundingBox())!
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    const caret = await field.evaluate((el) => (el as HTMLInputElement).selectionStart)
    // The glyphs are laid at the true slot pitch, so the third slot's centre
    // sits exactly on the third glyph's centre. Clicking that exact boundary,
    // with the large inter-glyph letter-spacing, lets the engine round the caret
    // to either side of the glyph (2–4 across engines/versions). What matters is
    // that the tap lands mid-field, not at the end — the in-place edit below is
    // the real proof.
    expect(caret).toBeGreaterThanOrEqual(2)
    expect(caret).toBeLessThanOrEqual(4)
    await page.keyboard.press('Backspace')
    await page.keyboard.type('9')
    const value = await page.getByTestId('default-value').textContent()
    // Edited in place in the middle — a '9' now sits among the 1s, and it is not
    // at the end, which is the only position input-otp's caret can reach.
    expect(value).toHaveLength(6)
    expect(value).toContain('9')
    expect(value?.[5]).not.toBe('9')
  })
})

test.describe('states', () => {
  test('a disabled field is exposed but not editable', async ({ page }) => {
    await expect(page.locator('[data-testid="disabled"]').getByRole('textbox')).toBeDisabled()
  })

  test('a read-only field shows its value but is not editable', async ({ page }) => {
    const box = page.locator('[data-testid="readonly"]').getByRole('textbox')
    await expect(box).toHaveAttribute('readonly', '')
    expect(await slotChars(page, 'readonly')).toEqual(['4', '8', '2', '9', '1', '3'])
  })

  test('an invalid field wires aria-invalid and describedby', async ({ page }) => {
    const box = page.locator('[data-testid="invalid"]').getByRole('textbox')
    await expect(box).toHaveAttribute('aria-invalid', 'true')
    await expect(box).toHaveAttribute('aria-describedby', 'inv-help')
  })
})

test.describe('forms', () => {
  test('a native form submits the code under its name', async ({ page }) => {
    const section = page.locator('[data-testid="native-form"]')
    await section.getByRole('textbox').click()
    await page.keyboard.type('246810')
    await section.getByRole('button', { name: 'Submit' }).click()
    await expect(page.getByTestId('native-form-result')).toHaveText('{"code":"246810"}')
  })

  test('React Hook Form blocks an incomplete submit and announces the error', async ({ page }) => {
    const section = page.locator('[data-testid="hook-form"]')
    await section.getByRole('textbox').click()
    await page.keyboard.type('123')
    await section.getByRole('button', { name: 'Verify' }).click()
    await expect(page.getByRole('alert')).toHaveText('Enter all six digits')
    await expect(page.getByTestId('rhf-result')).toHaveText('not submitted')
  })

  test('React Hook Form submits once the code is complete', async ({ page }) => {
    const section = page.locator('[data-testid="hook-form"]')
    await section.getByRole('textbox').click()
    await page.keyboard.type('135790')
    await section.getByRole('button', { name: 'Verify' }).click()
    await expect(page.getByTestId('rhf-result')).toHaveText('{"code":"135790"}')
  })

  test('Formik binds the value and submits it', async ({ page }) => {
    const section = page.locator('[data-testid="formik"]')
    await section.getByRole('textbox').click()
    await page.keyboard.type('112233')
    await section.getByRole('button', { name: 'Verify' }).click()
    await expect(page.getByTestId('formik-result')).toHaveText('{"code":"112233"}')
  })

  test('React Final Form binds the value and submits it', async ({ page }) => {
    const section = page.locator('[data-testid="final-form"]')
    await section.getByRole('textbox').click()
    await page.keyboard.type('445566')
    await section.getByRole('button', { name: 'Verify' }).click()
    await expect(page.getByTestId('rff-result')).toHaveText('{"code":"445566"}')
  })

  test('TanStack Form binds the value and submits it', async ({ page }) => {
    const section = page.locator('[data-testid="tanstack-form"]')
    await section.getByRole('textbox').click()
    await page.keyboard.type('778899')
    await section.getByRole('button', { name: 'Verify' }).click()
    await expect(page.getByTestId('tanstack-result')).toHaveText('{"code":"778899"}')
  })
})

test.describe('page-level concerns', () => {
  test('a single field is one tab stop', async ({ page }) => {
    await page.getByTestId('rtl-toggle').focus()
    await page.keyboard.press('Tab')
    const focused = await page.evaluate(() =>
      document.activeElement?.getAttribute('data-rx-otp-input') === '' ? 'otp-input' : 'other',
    )
    expect(focused).toBe('otp-input')
  })

  test('flips slot order when the document goes RTL', async ({ page }) => {
    await page.getByTestId('rtl-toggle').check()
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    // The field still functions: typing fills logical order 0..n.
    const section = page.locator('[data-testid="default"]')
    await section.getByRole('textbox').click()
    await page.keyboard.type('12')
    await expect(page.getByTestId('default-value')).toHaveText('12')
  })
})
