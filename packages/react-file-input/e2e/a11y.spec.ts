import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

/**
 * Scans the whole document rather than one mounted component, so it also
 * catches problems that only exist in composition — duplicate ids across
 * several fields, orphaned label targets, heading structure.
 */
async function scan(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  return results.violations.map((v) => `${v.id} (${String(v.nodes.length)}): ${v.help}`)
}

const textFile = (name: string) => ({
  name,
  mimeType: 'text/plain',
  buffer: Buffer.from('hello'),
})

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'File input' })).toBeVisible()
})

test('the whole demo page is free of WCAG A/AA violations', async ({ page }) => {
  expect(await scan(page)).toEqual([])
})

test('stays clean after adding and rejecting files', async ({ page }) => {
  await page
    .locator('[data-testid="multiple"] [data-rx-file-input]')
    .setInputFiles([textFile('a.txt'), textFile('b.txt')])
  await page
    .locator('[data-testid="rules"] [data-rx-file-input]')
    .setInputFiles([{ name: 'no.png', mimeType: 'image/png', buffer: Buffer.from([137, 80]) }])
  expect(await scan(page)).toEqual([])
})

test('every file input has an accessible name and stays in the tree', async ({ page }) => {
  // `display: none` would hide the control from assistive technology entirely;
  // the visually-hidden clip technique keeps it reachable.
  const styles = await page.locator('[data-rx-file-input]').evaluateAll((elements) =>
    elements.map((element) => ({
      display: getComputedStyle(element).display,
      visibility: getComputedStyle(element).visibility,
    })),
  )
  expect(styles.length).toBeGreaterThan(0)
  for (const style of styles) {
    expect(style.display).not.toBe('none')
    expect(style.visibility).not.toBe('hidden')
  }

  // Playwright's own accessible-name computation rather than a hand-rolled read
  // of `label[for]`: `label` on this component is the accessible name and
  // renders no element, so the only honest check is the one the browser's
  // accessibility tree would answer.
  const fields = page.locator('[data-rx-file-input]')
  const count = await fields.count()
  for (let i = 0; i < count; i++) {
    await expect(fields.nth(i)).toHaveAccessibleName(/\S/)
  }
})

test('every drop zone is a real button', async ({ page }) => {
  // Dragging has no keyboard equivalent, so the click path *is* the accessible
  // path — and a real button supplies Enter, Space, focus and a role for free.
  const zones = await page
    .locator('[data-rx-file-zone]')
    .evaluateAll((elements) =>
      elements.map((el) => ({ tag: el.tagName, type: el.getAttribute('type') })),
    )
  expect(zones.length).toBeGreaterThan(0)
  for (const zone of zones) {
    expect(zone.tag).toBe('BUTTON')
    expect(zone.type).toBe('button')
  }
})

test('every remove button names its own file', async ({ page }) => {
  // A list of buttons all called "Remove" is unusable in a screen reader's
  // element list, where they appear stripped of their surrounding text.
  await page
    .locator('[data-testid="multiple"] [data-rx-file-input]')
    .setInputFiles([textFile('one.txt'), textFile('two.txt')])
  const names = await page
    .locator('[data-rx-file-remove]')
    .evaluateAll((elements) => elements.map((el) => el.getAttribute('aria-label')))
  expect(names.length).toBeGreaterThan(0)
  for (const name of names) {
    expect(name).toBeTruthy()
    expect(name).not.toBe('Remove')
  }
})

test('every file list is a real list', async ({ page }) => {
  // So a screen reader announces "list, 2 items" before reading them.
  await page
    .locator('[data-testid="multiple"] [data-rx-file-input]')
    .setInputFiles([textFile('a.txt')])
  const tags = await page
    .locator('[data-rx-file-list]')
    .evaluateAll((elements) => elements.map((el) => el.tagName))
  expect(tags.length).toBeGreaterThan(0)
  expect(tags.every((tag) => tag === 'UL')).toBe(true)
})

test('every live region is polite, never assertive', async ({ page }) => {
  // Attaching a file is not an emergency; assertive would interrupt whatever
  // the user is already hearing.
  const modes = await page
    .locator('[data-rx-file-announcement]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('aria-live')))
  expect(modes.length).toBeGreaterThan(0)
  expect(modes.every((mode) => mode === 'polite')).toBe(true)
})

test('every preview image is marked decorative', async ({ page }) => {
  // The filename sits right beside it; alt text would be read twice.
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  )
  await page
    .locator('[data-testid="previews"] [data-rx-file-input]')
    .setInputFiles([{ name: 'dot.png', mimeType: 'image/png', buffer: png }])
  const alts = await page
    .locator('[data-rx-file-preview]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('alt')))
  expect(alts).toEqual([''])
  expect(await scan(page)).toEqual([])
})

test('every remove button meets the minimum target size', async ({ page }) => {
  // WCAG 2.5.8 Target Size (Minimum) is 24x24 CSS pixels.
  await page
    .locator('[data-testid="multiple"] [data-rx-file-input]')
    .setInputFiles([textFile('a.txt')])
  const boxes = await page.locator('[data-rx-file-remove]').evaluateAll((els) =>
    els.map((el) => {
      const rect = el.getBoundingClientRect()
      return { width: rect.width, height: rect.height }
    }),
  )
  expect(boxes.length).toBeGreaterThan(0)
  for (const box of boxes) {
    expect(box.width).toBeGreaterThanOrEqual(24)
    expect(box.height).toBeGreaterThanOrEqual(24)
  }
})

test('the field can be filled and emptied without a pointer', async ({ page }) => {
  await page
    .locator('[data-testid="multiple"] [data-rx-file-input]')
    .setInputFiles([textFile('a.txt'), textFile('b.txt')])
  const removes = page.locator('[data-testid="multiple"] [data-rx-file-remove]')
  await removes.first().focus()
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-testid="multiple"] [data-rx-file-name]')).toHaveCount(0)
})
