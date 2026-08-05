import { describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
// Static import so Vite pre-bundles axe-core with the other deps; a dynamic
// import triggers a mid-run optimize + reload that flakes the axe specs.
import axe from 'axe-core'
import { FileInput } from '../FileInput'

async function violations(container: HTMLElement) {
  const results = await axe.run(container, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
  })
  return results.violations.map((v) => `${v.id}: ${v.help}`)
}

function makeFile(name: string, type = 'text/plain') {
  return new File([new Uint8Array(10)], name, { type, lastModified: 1 })
}
function input(container: HTMLElement) {
  return container.querySelector<HTMLInputElement>('[data-rx-file-input]')!
}
function zone(container: HTMLElement) {
  return container.querySelector<HTMLButtonElement>('[data-rx-file-zone]')!
}

describe('semantics', () => {
  it('keeps a real, labelled file input in the tree', async () => {
    // Hidden visually, never `display: none` — that removes it from the
    // accessibility tree and, in some browsers, stops `.click()` working.
    const { container } = await render(<FileInput label="Attachments" name="files" />)
    const element = input(container)
    expect(element.type).toBe('file')
    expect(getComputedStyle(element).display).not.toBe('none')
    await expect.element(page.getByLabelText('Attachments')).toBeInTheDocument()
  })

  it('makes the drop zone a real button, not a clickable div', async () => {
    // Drag-and-drop has no keyboard equivalent, so the click path *is* the
    // accessible path — and a button gives Enter, Space, focus and a role free.
    const { container } = await render(<FileInput label="Files" />)
    expect(zone(container).tagName).toBe('BUTTON')
    expect(zone(container)).toHaveAttribute('type', 'button')
    await expect.element(page.getByRole('button', { name: /drop/i })).toBeInTheDocument()
  })

  it('opens the picker from the keyboard', async () => {
    let opened = false
    const { container } = await render(<FileInput label="Files" />)
    input(container).addEventListener('click', () => {
      opened = true
    })
    zone(container).focus()
    await userEvent.keyboard('{Enter}')
    expect(opened).toBe(true)
  })

  it('takes a custom hint', async () => {
    await render(<FileInput label="Files" hint="Drop your CV here" />)
    await expect
      .element(page.getByRole('button', { name: 'Drop your CV here' }))
      .toBeInTheDocument()
  })

  it('names every remove button after its own file', async () => {
    await render(
      <FileInput
        label="Files"
        multiple
        value={[makeFile('one.txt'), makeFile('two.txt')]}
        onChange={() => undefined}
      />,
    )
    await expect.element(page.getByRole('button', { name: 'Remove one.txt' })).toBeInTheDocument()
    await expect.element(page.getByRole('button', { name: 'Remove two.txt' })).toBeInTheDocument()
  })

  it('accepts a custom remove label', async () => {
    await render(
      <FileInput
        label="Files"
        value={[makeFile('cv.pdf')]}
        onChange={() => undefined}
        removeLabel={(file) => `Discard ${file.name}`}
      />,
    )
    await expect.element(page.getByRole('button', { name: 'Discard cv.pdf' })).toBeInTheDocument()
  })

  it('renders the selection as a real list', async () => {
    await render(
      <FileInput
        label="Files"
        multiple
        value={[makeFile('a.txt'), makeFile('b.txt')]}
        onChange={() => undefined}
      />,
    )
    expect(page.getByRole('listitem').elements()).toHaveLength(2)
  })

  it('marks a preview image as decorative', async () => {
    // The filename is right beside it, so a description would be read twice.
    const { container } = await render(
      <FileInput
        label="Files"
        previews
        value={[makeFile('photo.png', 'image/png')]}
        onChange={() => undefined}
      />,
    )
    const image = container.querySelector('[data-rx-file-preview]')
    expect(image).not.toBeNull()
    expect(image).toHaveAttribute('alt', '')
  })

  it('gives the remove buttons a big enough target', async () => {
    // WCAG 2.5.8 Target Size (Minimum) is 24x24 CSS pixels.
    const { container } = await render(
      <FileInput label="Files" value={[makeFile('a.txt')]} onChange={() => undefined} />,
    )
    const rect = container.querySelector('[data-rx-file-remove]')!.getBoundingClientRect()
    expect(rect.width).toBeGreaterThanOrEqual(24)
    expect(rect.height).toBeGreaterThanOrEqual(24)
  })

  it('wires invalid state to aria-invalid and data-invalid', async () => {
    const { container } = await render(
      <>
        <FileInput label="Files" invalid aria-describedby="err" />
        <p id="err">Attach at least one file</p>
      </>,
    )
    expect(input(container)).toHaveAttribute('aria-invalid', 'true')
    expect(input(container)).toHaveAttribute('aria-describedby', 'err')
    expect(container.querySelector('[data-rx-file-root]')).toHaveAttribute('data-invalid')
  })

  it('announces additions and removals politely', async () => {
    const { container } = await render(
      <FileInput label="Files" multiple value={[makeFile('a.txt')]} onChange={() => undefined} />,
    )
    const live = container.querySelector('[data-rx-file-announcement]')!
    expect(live).toHaveAttribute('aria-live', 'polite')
    await page.getByRole('button', { name: 'Remove a.txt' }).click()
    expect(live).toHaveTextContent('Removed a.txt')
  })

  it('moves focus to the next file after a removal, never to the body', async () => {
    // The clicked button leaves the DOM, and focus goes with it unless somebody
    // catches it — the single most common accessibility failure in this widget.
    const { container } = await render(
      <FileInput
        label="Files"
        multiple
        defaultValue={[makeFile('a.txt'), makeFile('b.txt'), makeFile('c.txt')]}
      />,
    )
    await page.getByRole('button', { name: 'Remove b.txt' }).click()
    expect(document.activeElement).toBe(container.querySelectorAll('[data-rx-file-remove]')[1])
    expect(document.activeElement).toHaveAttribute('aria-label', 'Remove c.txt')
  })

  it('falls back to the previous file when the last one is removed', async () => {
    const { container } = await render(
      <FileInput label="Files" multiple defaultValue={[makeFile('a.txt'), makeFile('b.txt')]} />,
    )
    await page.getByRole('button', { name: 'Remove b.txt' }).click()
    expect(document.activeElement).toBe(container.querySelector('[data-rx-file-remove]'))
  })

  it('returns focus to the drop zone when the list empties', async () => {
    const { container } = await render(
      <FileInput label="Files" defaultValue={[makeFile('only.txt')]} />,
    )
    await page.getByRole('button', { name: 'Remove only.txt' }).click()
    expect(document.activeElement).toBe(zone(container))
  })

  it('keeps the drop zone and every remove button in the tab order', async () => {
    // WebKit omits buttons from sequential navigation unless Full Keyboard
    // Access is enabled, so the tabindex has to be explicit.
    const { container } = await render(
      <FileInput label="Files" defaultValue={[makeFile('a.txt')]} />,
    )
    expect(zone(container).tabIndex).toBe(0)
    expect(container.querySelector<HTMLElement>('[data-rx-file-remove]')?.tabIndex).toBe(0)
  })

  it('disables both controls together', async () => {
    const { container } = await render(<FileInput label="Files" disabled />)
    expect(input(container)).toBeDisabled()
    expect(zone(container)).toBeDisabled()
  })
})

describe('axe', () => {
  it('is clean when empty', async () => {
    const { container } = await render(<FileInput label="Files" name="files" />)
    expect(await violations(container)).toEqual([])
  })

  it('is clean with files listed', async () => {
    const { container } = await render(
      <FileInput
        label="Files"
        name="files"
        multiple
        value={[makeFile('a.txt'), makeFile('b.pdf', 'application/pdf')]}
        onChange={() => undefined}
      />,
    )
    expect(await violations(container)).toEqual([])
  })

  it('is clean with image previews', async () => {
    const { container } = await render(
      <FileInput
        label="Files"
        name="files"
        previews
        value={[makeFile('photo.png', 'image/png')]}
        onChange={() => undefined}
      />,
    )
    expect(await violations(container)).toEqual([])
  })

  it('is clean while invalid and described', async () => {
    const { container } = await render(
      <>
        <FileInput label="Files" name="files" invalid aria-describedby="err" />
        <p id="err">Attach at least one file</p>
      </>,
    )
    expect(await violations(container)).toEqual([])
  })

  it('is clean while disabled and while read-only', async () => {
    const disabled = await render(<FileInput label="Files" name="files" disabled />)
    expect(await violations(disabled.container)).toEqual([])

    const readOnly = await render(
      <FileInput label="Files" readOnly value={[makeFile('a.txt')]} onChange={() => undefined} />,
    )
    expect(await violations(readOnly.container)).toEqual([])
  })

  it('is clean in a right-to-left direction', async () => {
    const { container } = await render(
      <div dir="rtl">
        <FileInput label="المرفقات" value={[makeFile('ملف.txt')]} onChange={() => undefined} />
      </div>,
    )
    expect(await violations(container)).toEqual([])
  })
})
