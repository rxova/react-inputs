import { describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { StrictMode, useState } from 'react'
import { DateInput } from '../DateInput'

/**
 * Chromium, not jsdom — and about event *sequences* rather than event handlers.
 *
 * The rest of the browser suite focuses segments programmatically and changes
 * props between interactions rather than during one. The sequences that break a
 * segmented field are the ones where those overlap: a controlled parent
 * re-rendering while a segment holds focus and a digit sits half-typed in the
 * buffer, or a pointer arriving where the tests only ever sent `.focus()`.
 */
function segment(container: HTMLElement, type: 'day' | 'month' | 'year') {
  return container.querySelector<HTMLElement>(`[data-rx-date-segment="${type}"]`)!
}
function text(container: HTMLElement, type: 'day' | 'month' | 'year') {
  return segment(container, type).textContent
}
function hidden(container: HTMLElement) {
  return container.querySelector<HTMLInputElement>('[data-rx-date-value]')!
}

describe('a controlled parent re-rendering mid-entry', () => {
  function Controlled({ initial }: { initial: string | null }) {
    const [value, setValue] = useState<string | null>(initial)
    return (
      <div>
        <DateInput
          label="Date"
          locale="en-GB"
          value={value}
          onChange={setValue}
          name="when"
          id="field"
        />
        <button
          type="button"
          data-testid="jump"
          onClick={() => {
            setValue('2024-02-29')
          }}
        >
          jump
        </button>
        <output data-testid="mirror">{value ?? 'null'}</output>
      </div>
    )
  }

  it('keeps focus on the segment the user is in when the value changes underneath', async () => {
    /**
     * The controlled re-sync adjusts state *during render*, which is the right
     * pattern — but it replaces every segment's content while one of them holds
     * focus. Focus has to survive that, or a parent that normalises the value
     * on every change silently ejects the user from the field.
     */
    const { container } = await render(<Controlled initial="2024-01-15" />)
    const year = segment(container, 'year')
    year.focus()
    expect(document.activeElement).toBe(year)

    container.querySelector<HTMLButtonElement>('[data-testid="jump"]')!.click()
    await vi.waitFor(() => {
      expect(text(container, 'day')).toBe('29')
    })
    expect(document.activeElement).toBe(segment(container, 'year'))
    expect(text(container, 'year')).toBe('2024')
  })

  it('discards a half-typed digit when the parent replaces the value', async () => {
    // The typing buffer holds digits that have not been committed. A value
    // arriving from outside has to win, and the buffer must not leak into the
    // next keystroke — that would produce a number the user never typed.
    const { container } = await render(<Controlled initial="2024-01-15" />)
    segment(container, 'day').focus()
    await userEvent.keyboard('2')
    expect(text(container, 'day')).toBe('02')

    container.querySelector<HTMLButtonElement>('[data-testid="jump"]')!.click()
    await vi.waitFor(() => {
      expect(text(container, 'day')).toBe('29')
    })

    await userEvent.keyboard('3')
    await vi.waitFor(() => {
      expect(text(container, 'day')).toBe('03')
    })
  })

  it('keeps the posted value and the visible segments in step throughout', async () => {
    const { container } = await render(<Controlled initial="2024-01-15" />)
    segment(container, 'month').focus()
    await userEvent.keyboard('0')
    container.querySelector<HTMLButtonElement>('[data-testid="jump"]')!.click()

    await vi.waitFor(() => {
      expect(hidden(container).value).toBe('2024-02-29')
    })
    expect(text(container, 'day')).toBe('29')
    expect(text(container, 'month')).toBe('02')
    expect(text(container, 'year')).toBe('2024')
  })
})

describe('pointer focus', () => {
  it('focuses a segment when it is clicked, despite user-select being off', async () => {
    /**
     * The segment style turns off the caret and text selection, which is the
     * right model for a spinbutton but is also exactly the kind of thing that
     * can stop a click focusing the element. Every component test here sets
     * focus programmatically; only the Playwright suite ever clicks, so if that
     * is skipped, click-to-focus has no coverage at all.
     */
    const { container } = await render(<DateInput label="Date" locale="en-GB" />)
    await userEvent.click(segment(container, 'month'))
    expect(document.activeElement).toBe(segment(container, 'month'))

    await userEvent.keyboard('7')
    await vi.waitFor(() => {
      expect(text(container, 'month')).toBe('07')
    })
  })

  it('produces no text selection when dragged across', async () => {
    const { container } = await render(
      <DateInput label="Date" locale="en-GB" defaultValue="2024-01-15" />,
    )
    const from = segment(container, 'day')
    const to = segment(container, 'year')
    const box = (element: HTMLElement) => element.getBoundingClientRect()

    await userEvent.dragAndDrop(from, to)
    // Geometry and selection, so it cannot be a jsdom assertion: jsdom has no
    // layout engine and would report an empty selection either way.
    expect(box(to).width).toBeGreaterThan(0)
    expect(window.getSelection()?.toString() ?? '').toBe('')
  })
})

describe('paste', () => {
  it('is inert on a segment, and says so by leaving the value alone', async () => {
    /**
     * Segments are spans, not text inputs, so there is nothing for a paste to
     * land in and the keydown handler bails on the modifier. That is a
     * deliberate contract rather than an oversight, and it was asserted
     * nowhere: a future handler that starts consuming `Ctrl+V` should have to
     * change a test to do it.
     */
    const onChange = vi.fn()
    const { container } = await render(
      <DateInput label="Date" locale="en-GB" defaultValue="2024-01-15" onChange={onChange} />,
    )
    const day = segment(container, 'day')
    day.focus()

    const data = new DataTransfer()
    data.setData('text', '2030-12-25')
    day.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
    )
    await userEvent.keyboard('{Control>}v{/Control}')

    expect(text(container, 'day')).toBe('15')
    expect(text(container, 'year')).toBe('2024')
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('typing past the last segment', () => {
  it('leaves focus on the last segment and keeps accepting digits', async () => {
    // Auto-advance clamps at the end rather than wrapping. The buffer is
    // cleared either way, so the digits that follow have to start a fresh
    // number in the same segment rather than extending the finished one.
    const { container } = await render(<DateInput label="Date" locale="en-GB" />)
    segment(container, 'year').focus()
    await userEvent.keyboard('2024')
    await vi.waitFor(() => {
      expect(text(container, 'year')).toBe('2024')
    })
    expect(document.activeElement).toBe(segment(container, 'year'))

    await userEvent.keyboard('1999')
    await vi.waitFor(() => {
      expect(text(container, 'year')).toBe('1999')
    })
    expect(document.activeElement).toBe(segment(container, 'year'))
  })
})

describe('StrictMode', () => {
  it('types a whole date under a double render', async () => {
    // The controlled re-sync runs during render, which StrictMode invokes
    // twice; a re-sync that was not idempotent would wipe the segments.
    const onChange = vi.fn()
    const { container } = await render(
      <StrictMode>
        <DateInput label="Date" locale="en-GB" onChange={onChange} name="when" />
      </StrictMode>,
    )
    segment(container, 'day').focus()
    await userEvent.keyboard('15012024')

    await vi.waitFor(() => {
      expect(hidden(container).value).toBe('2024-01-15')
    })
    expect(onChange).toHaveBeenLastCalledWith('2024-01-15')
  })
})
