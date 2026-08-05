import { describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { StrictMode, useState } from 'react'
import { TagsInput } from '../TagsInput'

/**
 * Chromium, not jsdom — and about event *sequences* rather than event handlers.
 *
 * The rest of the browser suite pastes into an always-empty box, sends `Enter`
 * with no composition in flight, and sets focus programmatically. Each of those
 * is a sequence a real user does not produce, and a handler can pass all of
 * them while being broken under the real one. Every test here reproduces a real
 * sequence: a caret in the middle of typed text, an IME confirming a candidate,
 * a controlled parent refusing a change.
 */
function box(container: HTMLElement) {
  return container.querySelector<HTMLInputElement>('[data-rx-tags-input]')!
}
function labels(container: HTMLElement) {
  return Array.from(container.querySelectorAll('[data-rx-tags-label]')).map((e) => e.textContent)
}
function removeButtons(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLButtonElement>('[data-rx-tags-remove]'))
}

/** Paste `text` into the box, replacing whatever is selected. */
function paste(element: HTMLInputElement, text: string) {
  const data = new DataTransfer()
  data.setData('text', text)
  const event = new ClipboardEvent('paste', {
    clipboardData: data,
    bubbles: true,
    cancelable: true,
  })
  element.dispatchEvent(event)
  return event
}

describe('pasting into a box that is not empty', () => {
  it('keeps text the user already typed', async () => {
    /**
     * Needs a real browser: the box has to hold live text and a live caret at
     * the moment the paste is dispatched, which is precisely what jsdom's
     * selection model fakes.
     *
     * A multi-value paste is consumed rather than let through, so whatever the
     * user had typed is the component's to preserve. Blanking the box loses it
     * outright — it is neither committed as a tag nor left to be corrected.
     */
    const { container } = await render(<TagsInput label="Tags" />)
    const element = box(container)
    await userEvent.fill(element, 'draft')
    paste(element, 'red,blue')

    await vi.waitFor(() => {
      expect(labels(container)).toEqual(['red', 'blue'])
    })
    expect(element.value).toBe('draft')
  })

  it('pastes at the caret rather than at the end, and leaves the caret there', async () => {
    // The caret assertion is the reason this cannot be a jsdom test: jsdom's
    // selection model would report back whatever the test just set.
    const { container } = await render(<TagsInput label="Tags" />)
    const element = box(container)
    await userEvent.fill(element, 'ab')
    element.focus()
    element.setSelectionRange(1, 1)
    paste(element, 'red,blue')

    await vi.waitFor(() => {
      expect(labels(container)).toEqual(['red', 'blue'])
    })
    expect(element.value).toBe('ab')
    expect(element.selectionStart).toBe(1)
    expect(element.selectionEnd).toBe(1)
  })

  it('replaces the selected text when the paste lands on a selection', async () => {
    const { container } = await render(<TagsInput label="Tags" />)
    const element = box(container)
    await userEvent.fill(element, 'throwaway')
    element.setSelectionRange(0, element.value.length)
    paste(element, 'red,blue')

    await vi.waitFor(() => {
      expect(labels(container)).toEqual(['red', 'blue'])
    })
    // The whole box was selected, so there is nothing left to keep.
    expect(element.value).toBe('')
  })

  it('leaves a single-value paste to the browser, text and caret included', async () => {
    const { container } = await render(<TagsInput label="Tags" />)
    const element = box(container)
    await userEvent.fill(element, 'draft')
    const event = paste(element, 'plain')

    expect(event.defaultPrevented).toBe(false)
    expect(labels(container)).toEqual([])
  })
})

describe('input method editors', () => {
  /**
   * With a Japanese, Chinese or Korean IME, the `Enter` that *confirms a
   * candidate* is delivered to the field as a normal keydown. Treating it as a
   * delimiter commits whatever half-composed text is in the box and eats the
   * keystroke that was meant to accept the candidate — the field is unusable
   * in those languages.
   *
   * `isComposing` is the platform's own flag for exactly this, and it is
   * settable through `KeyboardEventInit`, so the sequence is reproducible
   * without an IME attached.
   */
  function key(element: HTMLInputElement, init: KeyboardEventInit) {
    const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
    element.dispatchEvent(event)
    return event
  }

  it('does not commit on the Enter that confirms a candidate', async () => {
    const onChange = vi.fn()
    const { container } = await render(<TagsInput label="Tags" onChange={onChange} />)
    const element = box(container)
    element.focus()

    element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
    await userEvent.fill(element, 'にほん')
    key(element, { key: 'Enter', isComposing: true })

    expect(labels(container)).toEqual([])
    expect(onChange).not.toHaveBeenCalled()
    expect(element.value).toBe('にほん')
  })

  it('commits on the Enter that follows, once composition has ended', async () => {
    const { container } = await render(<TagsInput label="Tags" />)
    const element = box(container)
    element.focus()

    element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
    await userEvent.fill(element, 'にほん')
    key(element, { key: 'Enter', isComposing: true })
    element.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: 'にほん' }))
    key(element, { key: 'Enter' })

    await vi.waitFor(() => {
      expect(labels(container)).toEqual(['にほん'])
    })
  })

  it('does not treat a comma typed by an IME as a delimiter mid-composition', async () => {
    const { container } = await render(<TagsInput label="Tags" />)
    const element = box(container)
    element.focus()
    element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
    await userEvent.fill(element, 'ねこ')
    key(element, { key: ',', isComposing: true })

    expect(labels(container)).toEqual([])
  })

  it('does not remove a tag on the Backspace that deletes a composition candidate', async () => {
    const { container } = await render(<TagsInput label="Tags" defaultValue={['keep']} />)
    const element = box(container)
    element.focus()
    element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
    key(element, { key: 'Backspace', isComposing: true })

    expect(labels(container)).toEqual(['keep'])
    // Backspace in an empty box normally reaches for the last tag; during
    // composition it belongs to the IME.
    expect(document.activeElement).toBe(element)
  })
})

describe('focus handoff when a controlled parent refuses', () => {
  /** Renders a fresh array every time, and never accepts a removal. */
  function Refusing({ tags }: { tags: string[] }) {
    const [, bump] = useState(0)
    return (
      <div>
        {/* Refuses every change: `onChange` is deliberately inert. */}
        <TagsInput label="Tags" value={[...tags]} onChange={() => undefined} />
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
     * `removeAt` stashes where focus should go and an effect applies it once
     * the list re-renders. A controlled parent that refuses still causes
     * renders, so the stash has to be checked against the list that actually
     * arrived — otherwise it is replayed on the parent's next unrelated render
     * and yanks focus off whatever the user is on, several interactions later.
     */
    const { container } = await render(<Refusing tags={['a', 'b', 'c']} />)
    const buttons = removeButtons(container)
    buttons[2]!.focus()
    buttons[2]!.click()

    await vi.waitFor(() => {
      expect(labels(container)).toEqual(['a', 'b', 'c'])
    })
    expect(document.activeElement).toBe(removeButtons(container)[2])

    removeButtons(container)[2]!.focus()
    container.querySelector<HTMLButtonElement>('[data-testid="bump"]')!.click()
    await vi.waitFor(() => {
      expect(labels(container)).toEqual(['a', 'b', 'c'])
    })
    expect(document.activeElement).toBe(removeButtons(container)[2])
  })

  it('leaves the entry box focused when refusing the removal of the only tag', async () => {
    const { container } = await render(<Refusing tags={['only']} />)
    const element = box(container)
    removeButtons(container)[0]!.click()
    await vi.waitFor(() => {
      expect(labels(container)).toEqual(['only'])
    })

    element.focus()
    container.querySelector<HTMLButtonElement>('[data-testid="bump"]')!.click()
    await vi.waitFor(() => {
      expect(labels(container)).toEqual(['only'])
    })
    expect(document.activeElement).toBe(element)
  })
})

describe('StrictMode', () => {
  it('adds and removes without double-committing', async () => {
    // StrictMode double-invokes render and mount effects. The controlled value
    // is sanitised during render and the focus handoff runs in an effect, so
    // both are in its blast radius; nothing else in the suite renders under it.
    const onChange = vi.fn()
    const { container } = await render(
      <StrictMode>
        <TagsInput label="Tags" defaultValue={['first']} onChange={onChange} />
      </StrictMode>,
    )
    const element = box(container)
    await userEvent.fill(element, 'second')
    await userEvent.keyboard('{Enter}')

    await vi.waitFor(() => {
      expect(labels(container)).toEqual(['first', 'second'])
    })
    expect(onChange).toHaveBeenCalledTimes(1)

    removeButtons(container)[1]!.click()
    await vi.waitFor(() => {
      expect(labels(container)).toEqual(['first'])
    })
    expect(document.activeElement).toBe(removeButtons(container)[0])
  })
})
