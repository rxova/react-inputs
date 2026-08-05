import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { StrictMode, useState } from 'react'
import { FileInput } from '../FileInput'

/**
 * Chromium, not jsdom — and about event *sequences* rather than event handlers.
 *
 * The rest of the browser suite dispatches events in hand-balanced pairs: two
 * `dragover`s and two `dragleave`s, a paste into an always-empty box, a focus
 * set programmatically. That gets the DOM right and the sequence wrong, so a
 * handler can pass every existing test while being broken under the sequence a
 * real browser actually produces. Each test here reproduces a real one.
 */
function makeFile(name: string, options: { type?: string; size?: number; at?: number } = {}) {
  const { type = 'text/plain', size = 10, at = 1_700_000_000_000 } = options
  return new File([new Uint8Array(size)], name, { type, lastModified: at })
}

function root(container: HTMLElement) {
  return container.querySelector<HTMLElement>('[data-rx-file-root]')!
}
function zone(container: HTMLElement) {
  return container.querySelector<HTMLButtonElement>('[data-rx-file-zone]')!
}
function names(container: HTMLElement) {
  return Array.from(container.querySelectorAll('[data-rx-file-name]')).map((e) => e.textContent)
}
function removeButtons(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLButtonElement>('[data-rx-file-remove]'))
}

/** A `DataTransfer` carrying files, the way a real file drag does. */
function fileDrag(files: File[]) {
  const data = new DataTransfer()
  for (const file of files) data.items.add(file)
  return data
}

function dragEvent(type: string, data: DataTransfer) {
  return new DragEvent(type, { dataTransfer: data, bubbles: true, cancelable: true })
}

describe('real drag sequences', () => {
  it('clears the highlight when the pointer hovers and then leaves without dropping', async () => {
    /**
     * The sequence a browser actually emits: `dragenter` once, then `dragover`
     * repeatedly for as long as the pointer hovers — every few hundred
     * milliseconds and on every pointer move — then one `dragleave`.
     *
     * Counting `dragover` into the drag depth makes that depth climb without
     * bound, so the single matching `dragleave` can never bring it back to
     * zero and the zone stays lit for the life of the page.
     */
    const { container } = await render(<FileInput label="Files" />)
    const data = fileDrag([makeFile('a.txt')])
    const target = zone(container)

    target.dispatchEvent(dragEvent('dragenter', data))
    for (let tick = 0; tick < 20; tick++) target.dispatchEvent(dragEvent('dragover', data))
    await vi.waitFor(() => {
      expect(root(container)).toHaveAttribute('data-dragging')
    })

    target.dispatchEvent(dragEvent('dragleave', data))
    await vi.waitFor(() => {
      expect(root(container)).not.toHaveAttribute('data-dragging')
    })
  })

  it('keeps the highlight while the pointer crosses into a child element', async () => {
    /**
     * Crossing into a child fires `dragenter` on the child *before* `dragleave`
     * on the parent, and both bubble to the zone. The depth therefore goes
     * +1/-1 and never reaches zero, which is what stops the highlight
     * flickering as the pointer moves over the hint text.
     */
    const { container } = await render(<FileInput label="Files" hint={<span>Drop here</span>} />)
    const data = fileDrag([makeFile('a.txt')])
    const target = zone(container)
    const child = target.querySelector('span') ?? target

    target.dispatchEvent(dragEvent('dragenter', data))
    child.dispatchEvent(dragEvent('dragenter', data))
    target.dispatchEvent(dragEvent('dragleave', data))
    target.dispatchEvent(dragEvent('dragover', data))
    await vi.waitFor(() => {
      expect(root(container)).toHaveAttribute('data-dragging')
    })

    child.dispatchEvent(dragEvent('dragleave', data))
    await vi.waitFor(() => {
      expect(root(container)).not.toHaveAttribute('data-dragging')
    })
  })

  it('lights up and accepts a drop even when dragenter never arrives', async () => {
    // Dragging in from outside the viewport does not always produce a
    // `dragenter` the zone sees. `dragover` must still light the zone and must
    // still be prevented, or the browser refuses the drop outright.
    const { container } = await render(<FileInput label="Files" />)
    const data = fileDrag([makeFile('a.txt')])
    const over = dragEvent('dragover', data)
    zone(container).dispatchEvent(over)
    expect(over.defaultPrevented).toBe(true)
    await vi.waitFor(() => {
      expect(root(container)).toHaveAttribute('data-dragging')
    })

    zone(container).dispatchEvent(dragEvent('drop', fileDrag([makeFile('a.txt')])))
    await vi.waitFor(() => {
      expect(names(container)).toEqual(['a.txt'])
    })
    expect(root(container)).not.toHaveAttribute('data-dragging')
  })

  it('leaves a drop that carries no files to the browser', async () => {
    // `handleDragOver` and `handleDragLeave` both refuse a drag without files.
    // A drop must agree with them: consuming it would swallow the browser's
    // own default for, say, a dragged link.
    const { container } = await render(<FileInput label="Files" />)
    const data = new DataTransfer()
    data.setData('text/plain', 'just text')
    const event = dragEvent('drop', data)
    zone(container).dispatchEvent(event)

    expect(event.defaultPrevented).toBe(false)
    expect(names(container)).toEqual([])
    expect(root(container)).not.toHaveAttribute('data-dragging')
  })

  it('clears a highlight left over from an earlier drag when a stray drop lands', async () => {
    const { container } = await render(<FileInput label="Files" />)
    zone(container).dispatchEvent(dragEvent('dragenter', fileDrag([makeFile('a.txt')])))
    await vi.waitFor(() => {
      expect(root(container)).toHaveAttribute('data-dragging')
    })

    const text = new DataTransfer()
    text.setData('text/plain', 'just text')
    zone(container).dispatchEvent(dragEvent('drop', text))
    await vi.waitFor(() => {
      expect(root(container)).not.toHaveAttribute('data-dragging')
    })
  })
})

describe('focus handoff when a controlled parent refuses', () => {
  /** Renders a fresh array every time, and never accepts a removal. */
  function Refusing({ files }: { files: File[] }) {
    const [, bump] = useState(0)
    return (
      <div>
        {/* Refuses every change: `onChange` is deliberately inert. */}
        <FileInput label="Files" multiple value={[...files]} onChange={() => undefined} />
        <button
          type="button"
          data-testid="bump"
          onClick={() => {
            bump((count) => count + 1)
          }}
        >
          re-render
        </button>
      </div>
    )
  }

  it('does not move focus when the removal never lands', async () => {
    /**
     * `removeAt` stashes where focus should go next, and an effect applies it
     * once the list has re-rendered. A controlled parent that refuses the
     * change still causes renders — the announcement is state — so the stash
     * has to be validated against the list that actually arrived. Applying it
     * blindly moves focus to a *different* file's remove button while the file
     * the user tried to remove is still on screen.
     */
    const files = [makeFile('a.txt'), makeFile('b.txt'), makeFile('c.txt')]
    const { container } = await render(<Refusing files={files} />)
    const buttons = removeButtons(container)
    expect(buttons).toHaveLength(3)

    buttons[2]!.focus()
    buttons[2]!.click()

    await vi.waitFor(() => {
      expect(names(container)).toEqual(['a.txt', 'b.txt', 'c.txt'])
    })
    // The click landed on the last file's button; nothing was removed, so
    // focus belongs exactly where the user left it.
    expect(document.activeElement).toBe(removeButtons(container)[2])

    // The stash outlives the refused removal: the parent hands down a fresh
    // array on its *next*, unrelated render, the effect finally sees a changed
    // list and replays a move that no longer corresponds to anything. Focus is
    // yanked off whatever the user is on, several interactions later.
    removeButtons(container)[2]!.focus()
    container.querySelector<HTMLButtonElement>('[data-testid="bump"]')!.click()
    await vi.waitFor(() => {
      expect(names(container)).toEqual(['a.txt', 'b.txt', 'c.txt'])
    })
    expect(document.activeElement).toBe(removeButtons(container)[2])
  })

  it('does not send focus to the drop zone when the only file survives', async () => {
    const { container } = await render(<Refusing files={[makeFile('only.txt')]} />)
    const button = removeButtons(container)[0]!
    button.focus()
    button.click()

    await vi.waitFor(() => {
      expect(names(container)).toEqual(['only.txt'])
    })
    expect(document.activeElement).not.toBe(zone(container))
  })
})

describe('StrictMode', () => {
  it('mounts, previews and removes without leaking an object URL', async () => {
    /**
     * StrictMode double-invokes render and, on mount, runs effects twice. The
     * preview map is a lazily-initialised `useState` value mutated during
     * render, and its revocation runs in an unmount effect — exactly the shape
     * StrictMode is designed to catch. Nothing else in the suite renders under
     * it.
     */
    const create = vi.spyOn(URL, 'createObjectURL')
    const revoke = vi.spyOn(URL, 'revokeObjectURL')
    const image = new File([new Uint8Array(4)], 'shot.png', {
      type: 'image/png',
      lastModified: 1_700_000_000_000,
    })

    const { container, unmount } = await render(
      <StrictMode>
        <FileInput label="Files" previews multiple defaultValue={[image]} />
      </StrictMode>,
    )
    await vi.waitFor(() => {
      expect(names(container)).toEqual(['shot.png'])
    })
    const preview = container.querySelector('img')
    expect(preview?.getAttribute('src')).toMatch(/^blob:/)

    const minted = create.mock.results.map((result) => result.value as string)
    void unmount()
    await vi.waitFor(() => {
      const revoked = revoke.mock.calls.map((call) => call[0])
      for (const url of minted) expect(revoked).toContain(url)
    })
    create.mockRestore()
    revoke.mockRestore()
  })
})
