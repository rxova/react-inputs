import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

/**
 * Scans the whole document rather than one mounted component, so it also
 * catches problems that only exist in composition — duplicate ids across
 * several fields, orphaned aria-labelledby targets, heading structure.
 */
async function scan(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  return results.violations.map((v) => `${v.id} (${String(v.nodes.length)}): ${v.help}`)
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Date input' })).toBeVisible()
})

test('the whole demo page is free of WCAG A/AA violations', async ({ page }) => {
  expect(await scan(page)).toEqual([])
})

test('stays clean with a date entered and an out-of-range warning showing', async ({ page }) => {
  const section = page.locator('[data-testid="range"]')
  await section.locator('[data-rx-date-segment="day"]').click()
  await page.keyboard.type('15031999')
  await expect(section.locator('[data-rx-date-root]')).toHaveAttribute('data-out-of-range', '')
  expect(await scan(page)).toEqual([])
})

test('every field is a named group', async ({ page }) => {
  const names = await page.locator('[data-rx-date-root]').evaluateAll((elements) =>
    elements.map((element) => {
      const labelledBy = element.getAttribute('aria-labelledby')
      return labelledBy
        ? (document.getElementById(labelledBy)?.textContent ?? null)
        : element.getAttribute('aria-label')
    }),
  )
  expect(names.length).toBeGreaterThan(0)
  expect(names.every((name) => typeof name === 'string' && name.trim().length > 0)).toBe(true)
})

test('every segment is a named spinbutton with a coherent range', async ({ page }) => {
  const segments = await page.locator('[data-rx-date-segment]').evaluateAll((elements) =>
    elements.map((element) => ({
      role: element.getAttribute('role'),
      label: element.getAttribute('aria-label'),
      min: Number(element.getAttribute('aria-valuemin')),
      max: Number(element.getAttribute('aria-valuemax')),
      now: element.getAttribute('aria-valuenow'),
    })),
  )
  expect(segments.length).toBeGreaterThan(0)
  for (const segment of segments) {
    expect(segment.role).toBe('spinbutton')
    expect(segment.label).toBeTruthy()
    expect(segment.min).toBeLessThanOrEqual(segment.max)
    if (segment.now !== null) {
      expect(Number(segment.now)).toBeGreaterThanOrEqual(segment.min)
      expect(Number(segment.now)).toBeLessThanOrEqual(segment.max)
    }
  }
})

test('every aria-labelledby and aria-describedby points at something real', async ({ page }) => {
  const dangling = await page.evaluate(() => {
    const bad: string[] = []
    for (const attribute of ['aria-labelledby', 'aria-describedby']) {
      for (const element of document.querySelectorAll(`[${attribute}]`)) {
        for (const id of (element.getAttribute(attribute) ?? '').split(/\s+/)) {
          if (id && !document.getElementById(id)) bad.push(`${attribute}=${id}`)
        }
      }
    }
    return bad
  })
  expect(dangling).toEqual([])
})

test('the whole field can be filled without a pointer', async ({ page }) => {
  const section = page.locator('[data-testid="controlled"]')
  await section.locator('[data-rx-date-segment="day"]').focus()
  await page.keyboard.type('25')
  await page.keyboard.type('12')
  await page.keyboard.type('2030')
  await expect(page.getByTestId('value')).toHaveText('2030-12-25')
})
