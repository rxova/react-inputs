import { describe, expect, it, vi } from 'vitest'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { useRef, useState } from 'react'
import { FileInput } from '../FileInput'
import { useFileInput } from '../useFileInput'

/**
 * The development-diagnostics path, the render props, and the defensive edges.
 * These need a real mount: the warnings fire from an effect, and the guards are
 * only observable through real events.
 */
function makeFile(name: string, type = 'text/plain') {
  return new File([new Uint8Array(10)], name, { type, lastModified: 1 })
}
function input(container: HTMLElement) {
  return container.querySelector<HTMLInputElement>('[data-rfi-input]')!
}
function names(container: HTMLElement) {
  return Array.from(container.querySelectorAll('[data-rfi-name]')).map((e) => e.textContent)
}
async function pick(container: HTMLElement, files: File[]) {
  const data = new DataTransfer()
  for (const file of files) data.items.add(file)
  const element = input(container)
  element.files = data.files
  element.dispatchEvent(new Event('change', { bubbles: true }))
  await vi.waitFor(() => {
    expect(input(container)).toBeTruthy()
  })
}

describe('onWarn', () => {
  it('says nothing when everything is fine', async () => {
    const onWarn = vi.fn()
    await render(<FileInput label="Files" multiple accept=".png" maxSize={100} onWarn={onWarn} />)
    expect(onWarn).not.toHaveBeenCalled()
  })

  it('warns once per distinct problem, not once per selection', async () => {
    const onWarn = vi.fn()
    const { container } = await render(
      <FileInput label="Files" multiple maxFiles={0} onWarn={onWarn} />,
    )
    await pick(container, [makeFile('a.txt')])
    await pick(container, [makeFile('b.txt')])
    expect(onWarn.mock.calls.filter(([w]) => w.code === 'max-files-invalid')).toHaveLength(1)
  })

  it('falls back to console.warn when no handler is supplied', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    try {
      await render(<FileInput label="Files" multiple maxFiles={0} />)
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('[react-file-input]'))
    } finally {
      warn.mockRestore()
    }
  })

  it('reports the same problem once even when the effect re-runs', async () => {
    const seen: string[] = []
    function Noisy() {
      const [tick, setTick] = useState(0)
      return (
        <>
          <FileInput
            label="Files"
            multiple
            maxFiles={0}
            onWarn={(warning) => {
              seen.push(warning.code)
            }}
          />
          <button
            type="button"
            onClick={() => {
              setTick(tick + 1)
            }}
          >
            Re-render
          </button>
        </>
      )
    }
    await render(<Noisy />)
    await page.getByRole('button', { name: 'Re-render' }).click()
    await page.getByRole('button', { name: 'Re-render' }).click()
    expect(seen.filter((code) => code === 'max-files-invalid')).toHaveLength(1)
  })
})

describe('render props', () => {
  it('replaces the painted row while keeping the remove button', async () => {
    const { container } = await render(
      <FileInput
        label="Files"
        value={[makeFile('a.txt')]}
        onChange={() => undefined}
        renderFile={(state) => (
          <b data-custom="">
            {state.file.name} ({state.size})
          </b>
        )}
      />,
    )
    expect(container.querySelector('[data-custom]')).toHaveTextContent('a.txt (10 B)')
    await expect.element(page.getByRole('button', { name: 'Remove a.txt' })).toBeInTheDocument()
  })

  it('reports the index, size and preview to renderFile', async () => {
    const seen: { index: number; size: string; preview?: string }[] = []
    await render(
      <FileInput
        label="Files"
        multiple
        previews
        value={[makeFile('a.png', 'image/png')]}
        onChange={() => undefined}
        renderFile={(state) => {
          seen.push({ index: state.index, size: state.size, preview: state.preview })
          return state.file.name
        }}
      />,
    )
    expect(seen[0]?.index).toBe(0)
    expect(seen[0]?.size).toBe('10 B')
    expect(seen[0]?.preview).toMatch(/^blob:/)
  })

  it('renders without a label element when none is given', async () => {
    const { container } = await render(<FileInput aria-describedby="hint" />)
    expect(container.querySelector('[data-rfi-root] > label')).toBeNull()
  })

  it('accepts a custom announcer, including one that says nothing', async () => {
    const { container } = await render(<FileInput label="Files" announce={() => ''} />)
    await pick(container, [makeFile('a.txt')])
    await vi.waitFor(() => {
      expect(names(container)).toEqual(['a.txt'])
    })
    expect(container.querySelector('[data-rfi-announcement]')?.textContent).toBe('')
  })

  it('routes removals and clears through the custom announcer too', async () => {
    const seen: string[] = []
    function Harness() {
      const field = useFileInput({
        multiple: true,
        defaultValue: [makeFile('a.txt'), makeFile('b.txt')],
        announce: (event) => {
          seen.push(`${event.type}/${String(event.files.length)}`)
          return `${event.type} ${String(event.files.length)}`
        },
      })
      return (
        <>
          <output data-testid="say">{field.announcement}</output>
          <button
            type="button"
            onClick={() => {
              field.removeAt(0)
            }}
          >
            Remove first
          </button>
          <button type="button" onClick={field.clear}>
            Clear
          </button>
        </>
      )
    }
    await render(<Harness />)
    await page.getByRole('button', { name: 'Remove first' }).click()
    await expect.element(page.getByTestId('say')).toHaveTextContent('remove 1')
    await page.getByRole('button', { name: 'Clear' }).click()
    await expect.element(page.getByTestId('say')).toHaveTextContent('remove 0')
    expect(seen).toEqual(['remove/1', 'remove/0'])
  })

  it('survives a change event that carries no FileList', async () => {
    // `event.target.files` is nullable in the DOM types, and a synthetic event
    // from a test harness or a polyfill really can arrive with it unset.
    const onChange = vi.fn()
    const { container } = await render(<FileInput label="Files" onChange={onChange} />)
    const element = input(container)
    Object.defineProperty(element, 'files', { configurable: true, value: null })
    element.dispatchEvent(new Event('change', { bubbles: true }))
    await vi.waitFor(() => {
      expect(names(container)).toEqual([])
    })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('passes the rejected list to a custom announcer', async () => {
    const seen: { type: string; rejected: number }[] = []
    const { container } = await render(
      <FileInput
        label="Files"
        accept=".png"
        onReject={() => undefined}
        announce={(event) => {
          seen.push({ type: event.type, rejected: event.rejected?.length ?? 0 })
          return `${event.type}:${String(event.rejected?.length ?? 0)}`
        }}
      />,
    )
    await pick(container, [makeFile('a.txt')])
    await vi.waitFor(() => {
      expect(seen).toHaveLength(1)
    })
    expect(seen[0]).toEqual({ type: 'reject', rejected: 1 })
  })
})

describe('refs and the headless hook', () => {
  it('populates a callback ref and an object ref alike', async () => {
    let node: HTMLInputElement | null = null
    const { container } = await render(
      <FileInput
        label="Files"
        ref={(element) => {
          node = element
        }}
      />,
    )
    expect(node).toBe(input(container))

    function Harness() {
      const ref = useRef<HTMLInputElement>(null)
      const [tag, setTag] = useState('none')
      return (
        <>
          <FileInput label="Files" ref={ref} />
          <button
            type="button"
            onClick={() => {
              setTag(ref.current?.type ?? 'none')
            }}
          >
            Read ref
          </button>
          <output data-testid="tag">{tag}</output>
        </>
      )
    }
    await render(<Harness />)
    await page.getByRole('button', { name: 'Read ref' }).click()
    await expect.element(page.getByTestId('tag')).toHaveTextContent('file')
  })

  it('exposes clear(), which empties the selection at once', async () => {
    function Harness() {
      const field = useFileInput({ multiple: true, defaultValue: [makeFile('a'), makeFile('b')] })
      return (
        <>
          <output data-testid="count">{String(field.files.length)}</output>
          <button type="button" onClick={field.clear}>
            Clear
          </button>
        </>
      )
    }
    await render(<Harness />)
    await expect.element(page.getByTestId('count')).toHaveTextContent('2')
    await page.getByRole('button', { name: 'Clear' }).click()
    await expect.element(page.getByTestId('count')).toHaveTextContent('0')
  })

  it('does nothing when clear() is called on an empty field', async () => {
    const onChange = vi.fn()
    function Harness() {
      const field = useFileInput({ onChange })
      return (
        <button type="button" onClick={field.clear}>
          Clear
        </button>
      )
    }
    await render(<Harness />)
    await page.getByRole('button', { name: 'Clear' }).click()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('ignores removeAt for an index that does not exist', async () => {
    const onRemove = vi.fn()
    function Harness() {
      const field = useFileInput({ defaultValue: [makeFile('a')], onRemove })
      return (
        <>
          <output data-testid="count">{String(field.files.length)}</output>
          <button
            type="button"
            onClick={() => {
              field.removeAt(9)
            }}
          >
            Remove ghost
          </button>
        </>
      )
    }
    await render(<Harness />)
    await page.getByRole('button', { name: 'Remove ghost' }).click()
    await expect.element(page.getByTestId('count')).toHaveTextContent('1')
    expect(onRemove).not.toHaveBeenCalled()
  })

  it('refuses addFiles, removeAt and clear while read-only', async () => {
    function Harness() {
      const field = useFileInput({ readOnly: true, defaultValue: [makeFile('a')] })
      return (
        <>
          <output data-testid="count">{String(field.files.length)}</output>
          <button
            type="button"
            onClick={() => {
              field.addFiles([makeFile('b')])
            }}
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => {
              field.removeAt(0)
            }}
          >
            Remove
          </button>
          <button type="button" onClick={field.clear}>
            Clear
          </button>
        </>
      )
    }
    await render(<Harness />)
    for (const name of ['Add', 'Remove', 'Clear']) {
      await page.getByRole('button', { name }).click()
    }
    await expect.element(page.getByTestId('count')).toHaveTextContent('1')
  })

  it('ignores an empty addFiles call', async () => {
    const onChange = vi.fn()
    function Harness() {
      const field = useFileInput({ onChange })
      return (
        <button
          type="button"
          onClick={() => {
            field.addFiles([])
          }}
        >
          Add nothing
        </button>
      )
    }
    await render(<Harness />)
    await page.getByRole('button', { name: 'Add nothing' }).click()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('refuses open() while disabled', async () => {
    let opened = false
    function Harness() {
      const field = useFileInput({ disabled: true })
      return (
        <>
          <input
            type="file"
            ref={(node) => {
              field.inputRef.current = node
            }}
            onClick={() => {
              opened = true
            }}
          />
          <button type="button" onClick={field.open}>
            Open
          </button>
        </>
      )
    }
    await render(<Harness />)
    await page.getByRole('button', { name: 'Open' }).click()
    expect(opened).toBe(false)
  })

  it('ignores drag handlers while disabled', async () => {
    const { container } = await render(<FileInput label="Files" disabled />)
    const data = new DataTransfer()
    data.items.add(makeFile('a.txt'))
    const target = container.querySelector('[data-rfi-zone]')!
    target.dispatchEvent(
      new DragEvent('dragover', { dataTransfer: data, bubbles: true, cancelable: true }),
    )
    target.dispatchEvent(
      new DragEvent('dragleave', { dataTransfer: data, bubbles: true, cancelable: true }),
    )
    expect(container.querySelector('[data-rfi-root]')).not.toHaveAttribute('data-dragging')
  })

  it('leaves the native value in place after a pick, and clears it on removal', async () => {
    // Blanking the value after every pick is the usual trick for "let the user
    // re-pick the same file", but it also empties the control a native form
    // submit posts — the field would then show a file the server never gets.
    const { container } = await render(<FileInput label="Files" />)
    await pick(container, [makeFile('posted.txt')])
    await vi.waitFor(() => {
      expect(names(container)).toEqual(['posted.txt'])
    })
    expect(input(container).files?.length).toBe(1)

    await page.getByRole('button', { name: 'Remove posted.txt' }).click()
    // Cleared here instead, which is what makes re-picking the same file work.
    expect(input(container).value).toBe('')
  })

  it('ignores a dragleave that carries no files', async () => {
    const { container } = await render(<FileInput label="Files" />)
    const target = container.querySelector('[data-rfi-zone]')!
    const withFiles = new DataTransfer()
    withFiles.items.add(makeFile('a.txt'))
    target.dispatchEvent(
      new DragEvent('dragover', { dataTransfer: withFiles, bubbles: true, cancelable: true }),
    )
    const textOnly = new DataTransfer()
    textOnly.setData('text/plain', 'x')
    target.dispatchEvent(
      new DragEvent('dragleave', { dataTransfer: textOnly, bubbles: true, cancelable: true }),
    )
    // The text drag must not cancel the file drag's highlight.
    await vi.waitFor(() => {
      expect(container.querySelector('[data-rfi-root]')).toHaveAttribute('data-dragging')
    })
  })
})
