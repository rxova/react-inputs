import { describe, expect, it, vi } from 'vitest'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { useState } from 'react'
import { FileInput } from '../FileInput'

/**
 * Chromium, not jsdom. Everything here needs real `File`, `DataTransfer` and
 * `URL.createObjectURL` — jsdom has stubs for the first two and nothing useful
 * for the third, and the object-URL lifecycle is the part most worth testing.
 */
function makeFile(name: string, options: { type?: string; size?: number; at?: number } = {}) {
  const { type = 'text/plain', size = 10, at = 1_700_000_000_000 } = options
  return new File([new Uint8Array(size)], name, { type, lastModified: at })
}

function input(container: HTMLElement) {
  return container.querySelector<HTMLInputElement>('[data-rfi-input]')!
}
function names(container: HTMLElement) {
  return Array.from(container.querySelectorAll('[data-rfi-name]')).map((e) => e.textContent)
}
function zone(container: HTMLElement) {
  return container.querySelector<HTMLButtonElement>('[data-rfi-zone]')!
}

/** Drive the hidden input the way the native picker does. */
async function pick(container: HTMLElement, files: File[]) {
  const data = new DataTransfer()
  for (const file of files) data.items.add(file)
  const element = input(container)
  element.files = data.files
  element.dispatchEvent(new Event('change', { bubbles: true }))
  // Waits on the input itself rather than the root: `container` is sometimes
  // the root element, and `querySelector` only searches descendants.
  await vi.waitFor(() => {
    expect(input(container)).toBeTruthy()
  })
}

/** Drive a drop on the zone. */
function drop(container: HTMLElement, files: File[]) {
  const data = new DataTransfer()
  for (const file of files) data.items.add(file)
  zone(container).dispatchEvent(
    new DragEvent('drop', { dataTransfer: data, bubbles: true, cancelable: true }),
  )
}

describe('choosing files', () => {
  it('adds a picked file and reports it', async () => {
    const onChange = vi.fn()
    const { container } = await render(<FileInput label="Files" onChange={onChange} />)
    await pick(container, [makeFile('notes.txt')])
    await vi.waitFor(() => {
      expect(names(container)).toEqual(['notes.txt'])
    })
    expect(onChange.mock.calls.at(-1)?.[0]).toHaveLength(1)
  })

  it('shows a human-readable size', async () => {
    const { container } = await render(<FileInput label="Files" />)
    await pick(container, [makeFile('big.bin', { size: 1500 })])
    await vi.waitFor(() => {
      expect(container.querySelector('[data-rfi-size]')).toHaveTextContent('1.5 kB')
    })
  })

  it('replaces rather than appends on a single-file field', async () => {
    // The native input does the same; appending would silently ignore the
    // user's second pick.
    const { container } = await render(<FileInput label="File" />)
    await pick(container, [makeFile('one.txt')])
    await pick(container, [makeFile('two.txt')])
    await vi.waitFor(() => {
      expect(names(container)).toEqual(['two.txt'])
    })
  })

  it('appends on a multiple field', async () => {
    const { container } = await render(<FileInput label="Files" multiple />)
    await pick(container, [makeFile('one.txt')])
    await pick(container, [makeFile('two.txt')])
    await vi.waitFor(() => {
      expect(names(container)).toEqual(['one.txt', 'two.txt'])
    })
  })

  it('refuses a type the accept string does not allow', async () => {
    const onReject = vi.fn()
    const { container } = await render(
      <FileInput label="Files" accept=".png" onReject={onReject} />,
    )
    await pick(container, [makeFile('a.exe')])
    await vi.waitFor(() => {
      expect(onReject).toHaveBeenCalledWith(expect.objectContaining({ reason: 'type' }))
    })
    expect(names(container)).toEqual([])
  })

  it('enforces size bounds', async () => {
    const onReject = vi.fn()
    const { container } = await render(
      <FileInput label="Files" multiple maxSize={100} minSize={5} onReject={onReject} />,
    )
    await pick(container, [makeFile('big.bin', { size: 500 }), makeFile('tiny.bin', { size: 1 })])
    await vi.waitFor(() => {
      expect(onReject).toHaveBeenCalledTimes(2)
    })
    const reasons = onReject.mock.calls.map(([a]) => a.reason)
    expect(reasons).toEqual(['too-large', 'too-small'])
  })

  it('deduplicates by name, size and timestamp', async () => {
    const onReject = vi.fn()
    const { container } = await render(<FileInput label="Files" multiple onReject={onReject} />)
    await pick(container, [makeFile('a.txt', { at: 1 })])
    await pick(container, [makeFile('a.txt', { at: 1 })])
    await vi.waitFor(() => {
      expect(onReject).toHaveBeenCalledWith(expect.objectContaining({ reason: 'duplicate' }))
    })
    expect(names(container)).toEqual(['a.txt'])
  })

  it('honours maxFiles and reports being full', async () => {
    const { container } = await render(<FileInput label="Files" multiple maxFiles={2} />)
    await pick(container, [makeFile('a'), makeFile('b'), makeFile('c')])
    await vi.waitFor(() => {
      expect(names(container)).toEqual(['a', 'b'])
    })
    expect(container.querySelector('[data-rfi-root]')).toHaveAttribute('data-full')
  })

  it('applies a custom validate with its message', async () => {
    const onReject = vi.fn()
    const { container } = await render(
      <FileInput
        label="Files"
        validate={(file) => (file.name.startsWith('tmp') ? 'no temporary files' : true)}
        onReject={onReject}
      />,
    )
    await pick(container, [makeFile('tmp-1.txt')])
    await vi.waitFor(() => {
      expect(onReject).toHaveBeenCalledWith(
        expect.objectContaining({ reason: 'invalid', message: 'no temporary files' }),
      )
    })
  })

  it('fires onAdd per accepted file', async () => {
    const onAdd = vi.fn()
    const { container } = await render(<FileInput label="Files" multiple onAdd={onAdd} />)
    await pick(container, [makeFile('a'), makeFile('b')])
    await vi.waitFor(() => {
      expect(onAdd).toHaveBeenCalledTimes(2)
    })
  })
})

describe('dropping files', () => {
  it('accepts a drop', async () => {
    const { container } = await render(<FileInput label="Files" multiple />)
    drop(container, [makeFile('dropped.txt')])
    await vi.waitFor(() => {
      expect(names(container)).toEqual(['dropped.txt'])
    })
  })

  it('marks the zone while a file drag is over it', async () => {
    const { container } = await render(<FileInput label="Files" />)
    const data = new DataTransfer()
    data.items.add(makeFile('a.txt'))
    zone(container).dispatchEvent(
      new DragEvent('dragover', { dataTransfer: data, bubbles: true, cancelable: true }),
    )
    await vi.waitFor(() => {
      expect(container.querySelector('[data-rfi-root]')).toHaveAttribute('data-dragging')
    })
  })

  it('ignores a drag that carries no files', async () => {
    // Dragging selected text over the zone should not light it up.
    const { container } = await render(<FileInput label="Files" />)
    const data = new DataTransfer()
    data.setData('text/plain', 'just text')
    zone(container).dispatchEvent(
      new DragEvent('dragover', { dataTransfer: data, bubbles: true, cancelable: true }),
    )
    expect(container.querySelector('[data-rfi-root]')).not.toHaveAttribute('data-dragging')
  })

  it('does not flicker when the pointer crosses a child element', async () => {
    // `dragleave` fires on every crossing into a child, so a naive handler
    // turns the highlight off as the user moves over the hint text.
    const { container } = await render(<FileInput label="Files" />)
    const data = new DataTransfer()
    data.items.add(makeFile('a.txt'))
    const target = zone(container)
    const event = (type: string) =>
      new DragEvent(type, { dataTransfer: data, bubbles: true, cancelable: true })

    target.dispatchEvent(event('dragover'))
    target.dispatchEvent(event('dragover'))
    target.dispatchEvent(event('dragleave'))
    await vi.waitFor(() => {
      expect(container.querySelector('[data-rfi-root]')).toHaveAttribute('data-dragging')
    })
    target.dispatchEvent(event('dragleave'))
    await vi.waitFor(() => {
      expect(container.querySelector('[data-rfi-root]')).not.toHaveAttribute('data-dragging')
    })
  })

  it('clears the drag state on drop', async () => {
    const { container } = await render(<FileInput label="Files" />)
    const data = new DataTransfer()
    data.items.add(makeFile('a.txt'))
    zone(container).dispatchEvent(
      new DragEvent('dragover', { dataTransfer: data, bubbles: true, cancelable: true }),
    )
    drop(container, [makeFile('a.txt')])
    await vi.waitFor(() => {
      expect(container.querySelector('[data-rfi-root]')).not.toHaveAttribute('data-dragging')
    })
  })
})

describe('removing files', () => {
  it('removes on the button and reports it', async () => {
    const onRemove = vi.fn()
    const { container } = await render(<FileInput label="Files" multiple onRemove={onRemove} />)
    await pick(container, [makeFile('a.txt'), makeFile('b.txt')])
    await vi.waitFor(() => {
      expect(names(container)).toHaveLength(2)
    })
    await page.getByRole('button', { name: 'Remove a.txt' }).click()
    expect(names(container)).toEqual(['b.txt'])
    expect(onRemove.mock.calls.at(-1)?.[0]).toMatchObject({ name: 'a.txt' })
  })

  it('lets the same file be picked again after removing it', async () => {
    // The native input keeps its own value and fires no `change` for the same
    // file twice, so it has to be cleared on every add and remove.
    const { container } = await render(<FileInput label="Files" />)
    await pick(container, [makeFile('a.txt')])
    await vi.waitFor(() => {
      expect(names(container)).toEqual(['a.txt'])
    })
    await page.getByRole('button', { name: 'Remove a.txt' }).click()
    await pick(container, [makeFile('a.txt')])
    await vi.waitFor(() => {
      expect(names(container)).toEqual(['a.txt'])
    })
  })
})

describe('previews', () => {
  it('creates an object URL for an image only when asked', async () => {
    const withOut = await render(<FileInput label="Files" />)
    await pick(withOut.container, [makeFile('a.png', { type: 'image/png' })])
    await vi.waitFor(() => {
      expect(names(withOut.container)).toEqual(['a.png'])
    })
    expect(withOut.container.querySelector('[data-rfi-preview]')).toBeNull()

    const withPreviews = await render(<FileInput label="Files" previews />)
    await pick(withPreviews.container, [makeFile('b.png', { type: 'image/png' })])
    await vi.waitFor(() => {
      expect(withPreviews.container.querySelector('[data-rfi-preview]')).not.toBeNull()
    })
    expect(withPreviews.container.querySelector('[data-rfi-preview]')?.getAttribute('src')).toMatch(
      /^blob:/,
    )
  })

  it('makes no preview for a non-image', async () => {
    const { container } = await render(<FileInput label="Files" previews />)
    await pick(container, [makeFile('a.pdf', { type: 'application/pdf' })])
    await vi.waitFor(() => {
      expect(names(container)).toEqual(['a.pdf'])
    })
    expect(container.querySelector('[data-rfi-preview]')).toBeNull()
  })

  it('revokes the URL when the file is removed', async () => {
    // The part every alternative leaves to the caller. An unrevoked URL pins
    // the whole file in memory for the lifetime of the document.
    const revoke = vi.spyOn(URL, 'revokeObjectURL')
    try {
      const { container } = await render(<FileInput label="Files" previews />)
      await pick(container, [makeFile('a.png', { type: 'image/png' })])
      await vi.waitFor(() => {
        expect(container.querySelector('[data-rfi-preview]')).not.toBeNull()
      })
      const url = container.querySelector('[data-rfi-preview]')!.getAttribute('src')!
      await page.getByRole('button', { name: 'Remove a.png' }).click()
      await vi.waitFor(() => {
        expect(revoke).toHaveBeenCalledWith(url)
      })
    } finally {
      revoke.mockRestore()
    }
  })

  it('revokes everything on unmount', async () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL')
    try {
      const screen = await render(<FileInput label="Files" previews multiple />)
      await pick(screen.container, [
        makeFile('a.png', { type: 'image/png' }),
        makeFile('b.png', { type: 'image/png', at: 2 }),
      ])
      await vi.waitFor(() => {
        expect(screen.container.querySelectorAll('[data-rfi-preview]')).toHaveLength(2)
      })
      revoke.mockClear()
      void screen.unmount()
      await vi.waitFor(() => {
        expect(revoke).toHaveBeenCalledTimes(2)
      })
    } finally {
      revoke.mockRestore()
    }
  })

  it('reuses the same URL across re-renders of the same file', async () => {
    // Creating a fresh URL every render would leak one per keystroke elsewhere
    // on the page.
    const { container } = await render(<FileInput label="Files" previews multiple />)
    await pick(container, [makeFile('a.png', { type: 'image/png' })])
    await vi.waitFor(() => {
      expect(container.querySelector('[data-rfi-preview]')).not.toBeNull()
    })
    const first = container.querySelector('[data-rfi-preview]')!.getAttribute('src')
    await pick(container, [makeFile('b.png', { type: 'image/png', at: 2 })])
    await vi.waitFor(() => {
      expect(container.querySelectorAll('[data-rfi-preview]')).toHaveLength(2)
    })
    expect(container.querySelector('[data-rfi-preview]')!.getAttribute('src')).toBe(first)
  })
})

describe('controlled use and forms', () => {
  it('follows the parent', async () => {
    function Harness() {
      const [files, setFiles] = useState<File[]>([])
      return (
        <>
          <FileInput label="Files" multiple value={files} onChange={setFiles} />
          <button
            type="button"
            onClick={() => {
              setFiles([makeFile('injected.txt')])
            }}
          >
            Inject
          </button>
        </>
      )
    }
    const { container } = await render(<Harness />)
    await page.getByRole('button', { name: 'Inject' }).click()
    expect(names(container)).toEqual(['injected.txt'])
  })

  it('keeps the real input in the DOM, named and typed', async () => {
    const { container } = await render(
      <FileInput label="Files" name="attachment" accept=".png" multiple />,
    )
    const element = input(container)
    expect(element.type).toBe('file')
    expect(element).toHaveAttribute('name', 'attachment')
    expect(element).toHaveAttribute('accept', '.png')
    expect(element).toHaveAttribute('multiple')
  })

  it('requires the input only while nothing is selected', async () => {
    const { container } = await render(<FileInput label="Files" required />)
    expect(input(container)).toBeRequired()
    await pick(container, [makeFile('a.txt')])
    await vi.waitFor(() => {
      expect(input(container)).not.toBeRequired()
    })
  })

  it('fires onBlur only when focus leaves the whole field', async () => {
    const onBlur = vi.fn()
    const { container } = await render(
      <>
        <FileInput label="Files" onBlur={onBlur} />
        <button type="button">Elsewhere</button>
      </>,
    )
    zone(container).focus()
    input(container).focus()
    expect(onBlur).not.toHaveBeenCalled()
    await page.getByRole('button', { name: 'Elsewhere' }).click()
    expect(onBlur).toHaveBeenCalledTimes(1)
  })
})

describe('states', () => {
  it('refuses everything while disabled', async () => {
    const onChange = vi.fn()
    const { container } = await render(<FileInput label="Files" disabled onChange={onChange} />)
    expect(input(container)).toBeDisabled()
    expect(zone(container)).toBeDisabled()
    drop(container, [makeFile('a.txt')])
    expect(onChange).not.toHaveBeenCalled()
  })

  it('shows the selection but hides the remove buttons while read-only', async () => {
    const { container } = await render(
      <FileInput
        label="Files"
        readOnly
        value={[makeFile('locked.txt')]}
        onChange={() => undefined}
      />,
    )
    expect(names(container)).toEqual(['locked.txt'])
    expect(container.querySelector('[data-rfi-remove]')).toBeNull()
    expect(zone(container)).toBeDisabled()
  })
})
