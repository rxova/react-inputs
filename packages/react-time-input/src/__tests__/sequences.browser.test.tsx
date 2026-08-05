import { describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { StrictMode, useState } from 'react'
import { TimeInput } from '../TimeInput'

/**
 * Chromium, not jsdom — and about event *sequences* rather than event handlers.
 *
 * The rest of the browser suite focuses segments programmatically and changes
 * props between interactions rather than during one. The sequences that break a
 * segmented field are where those overlap: a controlled parent re-rendering
 * while a segment holds focus and a digit sits half-typed in the buffer.
 */
type Segment = 'hour' | 'minute' | 'second' | 'dayPeriod'

function segment(container: HTMLElement, type: Segment) {
  return container.querySelector<HTMLElement>(`[data-rx-time-segment="${type}"]`)!
}
function text(container: HTMLElement, type: Segment) {
  return segment(container, type).textContent
}
function hidden(container: HTMLElement) {
  return container.querySelector<HTMLInputElement>('[data-rx-time-value]')!
}

describe('a controlled parent re-rendering mid-entry', () => {
  function Controlled({ initial }: { initial: string | null }) {
    const [value, setValue] = useState<string | null>(initial)
    return (
      <div>
        <TimeInput
          label="Time"
          locale="en-GB"
          value={value}
          onChange={setValue}
          name="at"
          id="field"
        />
        <button
          type="button"
          data-testid="jump"
          onClick={() => {
            setValue('23:45')
          }}
        >
          jump
        </button>
      </div>
    )
  }

  it('keeps focus on the segment the user is in when the value changes underneath', async () => {
    const { container } = await render(<Controlled initial="09:30" />)
    const minute = segment(container, 'minute')
    minute.focus()

    container.querySelector<HTMLButtonElement>('[data-testid="jump"]')!.click()
    await vi.waitFor(() => {
      expect(text(container, 'hour')).toBe('23')
    })
    expect(document.activeElement).toBe(segment(container, 'minute'))
    expect(text(container, 'minute')).toBe('45')
  })

  it('discards a half-typed digit when the parent replaces the value', async () => {
    /**
     * The typing buffer holds digits for a number the user has not finished. A
     * value arriving from outside replaces the segment those digits belong to,
     * so keeping them makes the next keystroke extend a number that is no
     * longer on screen — the field reports a time nobody typed.
     */
    const { container } = await render(<Controlled initial="09:30" />)
    segment(container, 'minute').focus()
    await userEvent.keyboard('1')
    expect(text(container, 'minute')).toBe('01')

    container.querySelector<HTMLButtonElement>('[data-testid="jump"]')!.click()
    await vi.waitFor(() => {
      expect(text(container, 'minute')).toBe('45')
    })

    await userEvent.keyboard('5')
    await vi.waitFor(() => {
      expect(text(container, 'minute')).toBe('05')
    })
    expect(hidden(container).value).toBe('23:05')
  })

  it('discards a half-typed hour on a 12-hour clock too', async () => {
    // The 12-hour path runs every hour through the display translation, so the
    // buffer interacts with a second layer of state here.
    function TwelveHour() {
      const [value, setValue] = useState<string | null>('09:30')
      return (
        <div>
          <TimeInput label="Time" locale="en-US" value={value} onChange={setValue} />
          <button
            type="button"
            data-testid="jump"
            onClick={() => {
              setValue('14:45')
            }}
          >
            jump
          </button>
        </div>
      )
    }
    const { container } = await render(<TwelveHour />)
    segment(container, 'hour').focus()
    await userEvent.keyboard('1')

    container.querySelector<HTMLButtonElement>('[data-testid="jump"]')!.click()
    await vi.waitFor(() => {
      expect(text(container, 'hour')).toBe('02')
    })

    await userEvent.keyboard('8')
    await vi.waitFor(() => {
      expect(text(container, 'hour')).toBe('08')
    })
  })
})

describe('pointer focus', () => {
  it('focuses a segment when it is clicked, despite user-select being off', async () => {
    // Only the Playwright suite ever clicks a segment; every component test
    // sets focus programmatically. If that suite is skipped, click-to-focus
    // has no coverage at all.
    const { container } = await render(<TimeInput label="Time" locale="en-GB" />)
    await userEvent.click(segment(container, 'minute'))
    expect(document.activeElement).toBe(segment(container, 'minute'))

    await userEvent.keyboard('45')
    await vi.waitFor(() => {
      expect(text(container, 'minute')).toBe('45')
    })
  })
})

describe('the step grid', () => {
  it('snaps arrow stepping but leaves a typed value exactly as typed', async () => {
    /**
     * The documented contract, and the reason there is no `snapToStep` in
     * `time.ts`: the grid is for the arrows. Enforcing it on typed input would
     * fight the user mid-entry, and validating the final value is the form's
     * job. This pins both halves so neither can drift.
     */
    const { container } = await render(
      <TimeInput label="Time" locale="en-GB" minuteStep={15} name="at" />,
    )
    segment(container, 'hour').focus()
    await userEvent.keyboard('0907')
    await vi.waitFor(() => {
      expect(hidden(container).value).toBe('09:07')
    })

    segment(container, 'minute').focus()
    await userEvent.keyboard('{ArrowUp}')
    await vi.waitFor(() => {
      // Off-grid start, stepped by the grid amount rather than snapped onto it.
      expect(text(container, 'minute')).toBe('22')
    })
  })
})

describe('StrictMode', () => {
  it('types a whole time under a double render', async () => {
    const onChange = vi.fn()
    const { container } = await render(
      <StrictMode>
        <TimeInput label="Time" locale="en-GB" onChange={onChange} name="at" />
      </StrictMode>,
    )
    segment(container, 'hour').focus()
    await userEvent.keyboard('1430')

    await vi.waitFor(() => {
      expect(hidden(container).value).toBe('14:30')
    })
    expect(onChange).toHaveBeenLastCalledWith('14:30')
  })
})
