import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

/**
 * Runs on Chromium, Firefox and WebKit. What diverges between engines here is
 * exactly the part a component test cannot fake: the real file picker (only
 * `setInputFiles` drives it), whether a `<button>` is in the tab order at all
 * (WebKit leaves them out without Full Keyboard Access, which is why the remove
 * buttons carry an explicit tabindex), and how `DataTransfer` behaves when a
 * drop is synthesised.
 *
 * Anything needing a whole page also belongs here: tab order across a form, ids
 * unique across instances, a native submit round-trip.
 */
const inputIn = (section: string) => `[data-testid="${section}"] [data-rfi-input]`
const zoneIn = (section: string) => `[data-testid="${section}"] [data-rfi-zone]`
const namesIn = (section: string) => `[data-testid="${section}"] [data-rfi-name]`
const removesIn = (section: string) => `[data-testid="${section}"] [data-rfi-remove]`

function textFile(name: string, body = 'hello') {
  return { name, mimeType: 'text/plain', buffer: Buffer.from(body) }
}

async function pick(page: Page, section: string, files: ReturnType<typeof textFile>[]) {
  await page.locator(inputIn(section)).setInputFiles(files)
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'File input' })).toBeVisible()
})

test('picks a file through the real native input', async ({ page }) => {
  await pick(page, 'basic', [textFile('notes.txt')])
  await expect(page.locator(namesIn('basic'))).toHaveText(['notes.txt'])
})

test('a single-file field replaces rather than appends', async ({ page }) => {
  // The native control holds one file; showing two would misreport what a
  // submit would actually post.
  await pick(page, 'basic', [textFile('first.txt')])
  await pick(page, 'basic', [textFile('second.txt')])
  await expect(page.locator(namesIn('basic'))).toHaveText(['second.txt'])
})

test('a multiple field appends across separate picks', async ({ page }) => {
  await pick(page, 'multiple', [textFile('a.txt'), textFile('b.txt')])
  await pick(page, 'multiple', [textFile('c.txt')])
  await expect(page.locator(namesIn('multiple'))).toHaveText(['a.txt', 'b.txt', 'c.txt'])
})

test('re-picking a file that was just removed still registers', async ({ page }) => {
  // The native input keeps its own value and fires no `change` for the same
  // file twice — a real, frequently-shipped bug in this category of component.
  await pick(page, 'multiple', [textFile('again.txt')])
  await page.locator(removesIn('multiple')).first().click()
  await expect(page.locator(namesIn('multiple'))).toHaveCount(0)
  await pick(page, 'multiple', [textFile('again.txt')])
  await expect(page.locator(namesIn('multiple'))).toHaveText(['again.txt'])
})

test('deduplicates the same file across two drops', async ({ page }) => {
  // Driven through the drop path rather than `setInputFiles`, because identity
  // is name + size + timestamp and Playwright stamps every uploaded buffer with
  // the current time — two picks of "the same" file are genuinely two files as
  // far as the browser is concerned.
  const zone = page.locator(zoneIn('multiple'))
  const drop = () =>
    zone.evaluate((element) => {
      try {
        const data = new DataTransfer()
        data.items.add(new File(['same'], 'same.txt', { type: 'text/plain', lastModified: 42 }))
        if (data.files.length !== 1) return false
        element.dispatchEvent(
          new DragEvent('drop', { dataTransfer: data, bubbles: true, cancelable: true }),
        )
        return true
      } catch {
        return false
      }
    })

  const supported = await drop()
  test.skip(!supported, 'this engine cannot synthesise a file DataTransfer')
  await expect(page.locator(namesIn('multiple'))).toHaveText(['same.txt'])
  await drop()
  await expect(page.locator(namesIn('multiple'))).toHaveText(['same.txt'])
})

test('reports the controlled value to the parent', async ({ page }) => {
  await pick(page, 'controlled', [textFile('one.txt'), textFile('two.txt')])
  await expect(page.getByTestId('value')).toHaveText('one.txt|two.txt')
  await page.locator('[data-testid="controlled"]').getByRole('button', { name: 'Clear' }).click()
  await expect(page.getByTestId('value')).toHaveText('empty')
})

test('refuses the wrong type, the wrong size and the wrong count with distinct reasons', async ({
  page,
}) => {
  await page
    .locator(inputIn('rules'))
    .setInputFiles([
      { name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from([137, 80, 78, 71]) },
    ])
  await expect(page.getByTestId('rejection')).toHaveText('type:photo.png')

  await page
    .locator(inputIn('rules'))
    .setInputFiles([{ name: 'big.txt', mimeType: 'text/plain', buffer: Buffer.alloc(2000) }])
  await expect(page.getByTestId('rejection')).toHaveText('too-large:big.txt')

  await pick(page, 'rules', [textFile('secret-plan.txt')])
  await expect(page.getByTestId('rejection')).toHaveText('invalid:secret-plan.txt')
  await expect(page.getByTestId('rejection-message')).toHaveText('that one stays home')

  await pick(page, 'rules', [
    textFile('1.txt', 'a'),
    textFile('2.txt', 'b'),
    textFile('3.txt', 'c'),
    textFile('4.txt', 'd'),
  ])
  await expect(page.locator(namesIn('rules'))).toHaveCount(3)
  await expect(page.getByTestId('rejection')).toHaveText('max-files:4.txt')
})

test('accepts a valid file after a rejection, rather than jamming', async ({ page }) => {
  await pick(page, 'rules', [textFile('secret-plan.txt')])
  await expect(page.locator(namesIn('rules'))).toHaveCount(0)
  await pick(page, 'rules', [textFile('fine.txt')])
  await expect(page.locator(namesIn('rules'))).toHaveText(['fine.txt'])
})

test('renders an image preview and revokes it on removal', async ({ page }) => {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  )
  await page
    .locator(inputIn('previews'))
    .setInputFiles([{ name: 'dot.png', mimeType: 'image/png', buffer: png }])
  const preview = page.locator('[data-testid="previews"] [data-rfi-preview]')
  await expect(preview).toHaveCount(1)
  const url = await preview.getAttribute('src')
  expect(url).toMatch(/^blob:/)

  await page.locator(removesIn('previews')).first().click()
  await expect(preview).toHaveCount(0)
  // A revoked object URL no longer resolves; an unrevoked one still would.
  const stillResolves = await page.evaluate(
    (href) =>
      fetch(href)
        .then(() => true)
        .catch(() => false),
    url!,
  )
  expect(stillResolves).toBe(false)
})

test('accepts a synthesised drop and highlights while dragging', async ({ page }) => {
  const zone = page.locator(zoneIn('multiple'))
  const root = page.locator('[data-testid="multiple"] [data-rfi-root]')

  const supported = await zone.evaluate((element) => {
    try {
      const data = new DataTransfer()
      data.items.add(new File(['x'], 'dropped.txt', { type: 'text/plain' }))
      if (data.files.length !== 1) return false
      element.dispatchEvent(
        new DragEvent('dragover', { dataTransfer: data, bubbles: true, cancelable: true }),
      )
      element.dispatchEvent(
        new DragEvent('drop', { dataTransfer: data, bubbles: true, cancelable: true }),
      )
      return true
    } catch {
      return false
    }
  })

  // Reported, never silently passed: an engine that cannot construct a file
  // DataTransfer would otherwise make this test look green while asserting
  // nothing at all.
  test.skip(!supported, 'this engine cannot synthesise a file DataTransfer')

  await expect(page.locator(namesIn('multiple'))).toHaveText(['dropped.txt'])
  await expect(root).not.toHaveAttribute('data-dragging', /.*/)
})

test('opens the picker from the keyboard alone', async ({ page }) => {
  const zone = page.locator(zoneIn('basic'))
  await zone.focus()
  await expect(zone).toBeFocused()
  // The picker is a native modal, so catch it as a file-chooser event and set
  // the files through it rather than letting the dialog block the run.
  const chooser = page.waitForEvent('filechooser')
  await page.keyboard.press('Enter')
  await (await chooser).setFiles([textFile('typed.txt')])
  await expect(page.locator(namesIn('basic'))).toHaveText(['typed.txt'])
})

test('keeps focus inside the field after a removal', async ({ page }) => {
  // Leaving focus on a button that no longer exists drops it to <body>, which
  // is the most common accessibility failure in this widget.
  await pick(page, 'multiple', [textFile('a.txt'), textFile('b.txt')])
  await page.locator(removesIn('multiple')).first().focus()
  await page.keyboard.press('Enter')
  await expect(page.locator(namesIn('multiple'))).toHaveText(['b.txt'])
  const inside = await page.evaluate(() =>
    Boolean(
      document.activeElement &&
      document.activeElement !== document.body &&
      document
        .querySelector('[data-testid="multiple"] [data-rfi-root]')
        ?.contains(document.activeElement),
    ),
  )
  expect(inside).toBe(true)
})

test('announces additions and removals in a polite live region', async ({ page }) => {
  const live: Locator = page.locator('[data-testid="basic"] [data-rfi-announcement]')
  await expect(live).toHaveAttribute('aria-live', 'polite')
  await pick(page, 'basic', [textFile('spoken.txt')])
  await expect(live).toContainText('spoken.txt')
  await page.locator(removesIn('basic')).first().click()
  await expect(live).toContainText('Removed spoken.txt')
})

test('strips the diagnostics path from a production build', async ({ page }) => {
  // The demo is a *production* Vite build, so `process.env.NODE_ENV` folds to
  // "production" and the whole `onWarn` branch — and `warn.ts` with it — is
  // dropped by the bundler. The demo deliberately passes `maxFiles={0}` and an
  // inverted size range; an empty list here is the evidence it works.
  await expect(page.getByTestId('warning-codes')).toBeEmpty()
  // And the field still works, with the unusable limits ignored.
  await pick(page, 'warnings', [textFile('still-works.txt')])
  await expect(page.locator(namesIn('warnings'))).toHaveText(['still-works.txt'])
})

test('posts the file through a native form submit', async ({ page }) => {
  await pick(page, 'native-form', [textFile('cv.txt')])
  await page.locator('[data-testid="native-form"]').getByRole('button', { name: 'Save' }).click()
  await expect(page.getByTestId('submitted')).toHaveText('cv.txt')
})

test('a disabled field takes no input and its zone is disabled', async ({ page }) => {
  await expect(page.locator(inputIn('state-disabled'))).toBeDisabled()
  await expect(page.locator(zoneIn('state-disabled'))).toBeDisabled()
})

test('a read-only field lists its files with no remove buttons at all', async ({ page }) => {
  // A visible but inert button is a worse affordance than no button.
  await expect(page.locator(namesIn('state-readonly'))).toHaveText(['contract.pdf'])
  await expect(page.locator(removesIn('state-readonly'))).toHaveCount(0)
})

test('every id on the page is unique across instances', async ({ page }) => {
  const ids = await page.locator('[id]').evaluateAll((els) => els.map((el) => el.id))
  expect(new Set(ids).size).toBe(ids.length)
})
