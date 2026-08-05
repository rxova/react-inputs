import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Rating input' })).toBeVisible()
})

/** Measured fill ratio for one icon, from real layout in a real page. */
async function fillRatio(page: Page, testid: string, index: number) {
  return page.evaluate(
    ({ testid, index }) => {
      const item = document.querySelector<HTMLElement>(
        `[data-testid="${testid}"] [data-rx-rating-item="${String(index)}"]`,
      )
      if (!item) throw new Error(`no item ${String(index)} in ${testid}`)
      const fill = item.querySelector<HTMLElement>('[data-rx-rating-layer="fill"]')
      if (!fill) throw new Error('no fill layer')
      return fill.getBoundingClientRect().width / item.getBoundingClientRect().width
    },
    { testid, index },
  )
}

test.describe('display', () => {
  test('renders a continuous partial fill in a real page', async ({ page }) => {
    expect(await fillRatio(page, 'display-continuous', 4)).toBeCloseTo(0.3, 1)
    expect(await fillRatio(page, 'display-continuous', 0)).toBeCloseTo(1, 1)
  })

  test('applies each rounding mode', async ({ page }) => {
    expect(await fillRatio(page, 'display-whole', 4)).toBeCloseTo(0, 1)
    expect(await fillRatio(page, 'display-half', 4)).toBeCloseTo(0.5, 1)
  })

  test('emits a clean percentage into the style attribute', async ({ page }) => {
    // Regression guard: 4.3 once produced width:29.999999999999982%.
    const width = await page
      .locator(
        '[data-testid="display-continuous"] [data-rx-rating-item="4"] [data-rx-rating-layer="fill"]',
      )
      .evaluate((el) => el.getAttribute('style'))
    expect(width).toContain('width: 30%')
  })

  test('renders emoji and ZWJ sequences at the right geometry', async ({ page }) => {
    expect(await fillRatio(page, 'display-emoji', 3)).toBeCloseTo(0.5, 1)
    expect(await fillRatio(page, 'display-zwj', 2)).toBeCloseTo(0.5, 1)
    await expect(page.locator('[data-testid="display-zwj"]')).toContainText('👩‍🍳')
  })

  test('honours a custom max and icon', async ({ page }) => {
    const items = page.locator('[data-testid="display-custom-svg"] [data-rx-rating-item]')
    await expect(items).toHaveCount(7)
    expect(await fillRatio(page, 'display-custom-svg', 5)).toBeCloseTo(0.5, 1)
  })

  test('scales with --rx-rating-size', async ({ page }) => {
    const box = await page
      .locator('[data-testid="display-scaled"] [data-rx-rating-item="0"]')
      .boundingBox()
    // 2.5rem at a 16px root.
    expect(box?.width).toBeCloseTo(40, 0)
  })
})

test.describe('interaction', () => {
  test('previews on hover and commits on click', async ({ page }) => {
    const section = page.locator('[data-testid="interactive"]')
    await section.getByRole('radio', { name: '4 of 5' }).hover()
    await expect(page.getByTestId('interactive-hover')).toHaveText('4')
    await expect(page.getByTestId('interactive-value')).toHaveText('0')

    await section.getByRole('radio', { name: '4 of 5' }).click()
    await expect(page.getByTestId('interactive-value')).toHaveText('4')

    await page.getByRole('heading', { name: 'Rating input' }).hover()
    await expect(page.getByTestId('interactive-hover')).toHaveText('none')
  })

  test('selects a half step', async ({ page }) => {
    const section = page.locator('[data-testid="interactive"]')
    await section.getByRole('radio', { name: '3.5 of 5' }).click()
    await expect(page.getByTestId('interactive-value')).toHaveText('3.5')
  })

  test('clears when the current value is re-selected', async ({ page }) => {
    const section = page.locator('[data-testid="interactive"]')
    await section.getByRole('radio', { name: '2 of 5' }).click()
    await expect(page.getByTestId('interactive-value')).toHaveText('2')
    await section.getByRole('radio', { name: '2 of 5' }).click()
    await expect(page.getByTestId('interactive-value')).toHaveText('0')
  })

  test('does not accept input when disabled', async ({ page }) => {
    const group = page.locator('[data-testid="disabled"]').getByRole('radiogroup')
    await expect(group).toHaveAttribute('aria-disabled', 'true')
    await expect(group.getByRole('radio').first()).toBeDisabled()
  })
})

test.describe('keyboard', () => {
  test('each rating group is a single tab stop across the page', async ({ page }) => {
    // Full-page tab order is exactly what a component-level test cannot check.
    await page.getByTestId('rtl-toggle').focus()

    const describeFocus = () =>
      page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null
        if (!el || el === document.body) return 'none'
        const section = el.closest('[data-testid]')?.getAttribute('data-testid')
        if (el.closest('[data-rx-rating-root]')) return `rating:${section ?? '?'}`
        // textContent is only nullable on Document/DocumentType nodes, never
        // on an HTMLElement, which is what activeElement narrows to here.
        return `${el.tagName.toLowerCase()}:${el.textContent.trim()}`
      })

    const stops: string[] = []
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab')
      stops.push(await describeFocus())
    }

    // Asserted as "no rating occupies two consecutive tab stops" rather than by
    // counting occurrences, because tab order itself is engine-specific: Safari
    // only tabs between form controls by default, so it skips every <button>
    // and wraps sooner. Consecutive duplicates are the engine-independent
    // signature of a group that costs more than one Tab — the exact regression
    // the roving tabindex exists to prevent, which would show up here as ten
    // consecutive `rating:interactive` entries.
    const ratingStops = stops.filter((s) => s.startsWith('rating:'))
    expect(ratingStops.length).toBeGreaterThan(0)
    for (let i = 1; i < stops.length; i++) {
      if (stops[i]!.startsWith('rating:')) {
        expect(stops[i], `\`${stops[i]!}\` occupies consecutive tab stops`).not.toBe(stops[i - 1])
      }
    }

    // Read-only is not a control, and disabled radios are not focusable.
    expect(stops).not.toContain('rating:readonly')
    expect(stops).not.toContain('rating:disabled')
  })

  test('arrow keys move the selection', async ({ page }) => {
    const section = page.locator('[data-testid="interactive"]')
    await section.getByRole('radio', { name: '2 of 5' }).click()
    await page.keyboard.press('ArrowRight')
    await expect(page.getByTestId('interactive-value')).toHaveText('2.5')
    await page.keyboard.press('ArrowLeft')
    await expect(page.getByTestId('interactive-value')).toHaveText('2')
  })

  test('digit keys jump and Backspace clears', async ({ page }) => {
    const section = page.locator('[data-testid="interactive"]')
    await section.getByRole('radio', { name: '1 of 5' }).click()
    await page.keyboard.press('4')
    await expect(page.getByTestId('interactive-value')).toHaveText('4')
    await page.keyboard.press('Backspace')
    await expect(page.getByTestId('interactive-value')).toHaveText('0')
  })
})

test.describe('forms', () => {
  test('a native form submits the value under its name', async ({ page }) => {
    const section = page.locator('[data-testid="native-form"]')
    await section.getByRole('radio', { name: '4 of 5' }).click()
    await section.getByRole('button', { name: 'Submit' }).click()
    await expect(page.getByTestId('native-form-result')).toHaveText('{"score":"4"}')
  })

  test('React Hook Form blocks an empty submit and announces the error', async ({ page }) => {
    const section = page.locator('[data-testid="hook-form"]')
    await section.getByRole('button', { name: 'Send review' }).click()

    await expect(page.getByRole('alert')).toHaveText('Please rate before submitting')
    await expect(section.getByRole('radiogroup')).toHaveAttribute('aria-invalid', 'true')
    await expect(section.getByRole('radiogroup')).toHaveAttribute('aria-describedby', 'rhf-error')
    await expect(page.getByTestId('rhf-result')).toHaveText('not submitted')
  })

  test('React Hook Form submits once a rating is chosen', async ({ page }) => {
    const section = page.locator('[data-testid="hook-form"]')
    await section.getByRole('radio', { name: '4.5 of 5' }).click()
    await section.getByRole('button', { name: 'Send review' }).click()
    await expect(page.getByTestId('rhf-result')).toHaveText('{"rating":4.5}')
  })
})

test.describe('page-level concerns', () => {
  test('flips the fill origin when the document goes RTL', async ({ page }) => {
    const item = page.locator('[data-testid="display-half"] [data-rx-rating-item="4"]')
    const fill = item.locator('[data-rx-rating-layer="fill"]')

    const ltr = { item: await item.boundingBox(), fill: await fill.boundingBox() }
    expect(ltr.fill!.x).toBeCloseTo(ltr.item!.x, 0)

    await page.getByTestId('rtl-toggle').check()
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')

    const rtl = { item: await item.boundingBox(), fill: await fill.boundingBox() }
    // Right edges now coincide instead of left edges.
    expect(rtl.fill!.x + rtl.fill!.width).toBeCloseTo(rtl.item!.x + rtl.item!.width, 0)
    expect(rtl.fill!.x).toBeGreaterThan(rtl.item!.x + 1)
  })

  test('drops the transition under prefers-reduced-motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.reload()
    const duration = await page
      .locator('[data-testid="display-continuous"] [data-rx-rating-layer="fill"]')
      .first()
      .evaluate((el) => getComputedStyle(el).transitionDuration)
    expect(duration).toBe('0s')
  })

  test('keeps the transition with no motion preference', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.reload()
    const duration = await page
      .locator('[data-testid="display-continuous"] [data-rx-rating-layer="fill"]')
      .first()
      .evaluate((el) => getComputedStyle(el).transitionDuration)
    expect(duration).not.toBe('0s')
  })

  test('shows a visible focus ring that the fill layer cannot clip', async ({ page }) => {
    await page.getByTestId('rtl-toggle').focus()
    await page.keyboard.press('Tab')
    const outline = await page.evaluate(() => {
      const el = document.activeElement?.closest('[data-rx-rating-item]')
      return el ? getComputedStyle(el).outlineStyle : 'none'
    })
    expect(outline).not.toBe('none')
  })
})
