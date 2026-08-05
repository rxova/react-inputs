import { describe, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { useState } from 'react'
import { TimeInput } from '../TimeInput'

/**
 * Chromium, not jsdom. Everything here depends on real focus movement between
 * sibling elements — auto-advance, `relatedTarget` on blur, and the tab order —
 * none of which jsdom models faithfully enough to be worth asserting.
 */
type Seg = 'hour' | 'minute' | 'second' | 'dayPeriod'

function seg(container: HTMLElement, type: Seg) {
  return container.querySelector<HTMLElement>(`[data-rx-time-segment="${type}"]`)!
}

function text(container: HTMLElement, type: Seg) {
  return seg(container, type).textContent
}

describe('layout', () => {
  it('shows a 24-hour field with no day period for a 24-hour locale', async () => {
    const { container } = await render(<TimeInput label="Time" locale="en-GB" />)
    expect(
      Array.from(container.querySelectorAll('[data-rx-time-segment]')).map((element) =>
        element.getAttribute('data-rx-time-segment'),
      ),
    ).toEqual(['hour', 'minute'])
  })

  it('shows a day period for a 12-hour locale', async () => {
    const { container } = await render(<TimeInput label="Time" locale="en-US" />)
    expect(
      Array.from(container.querySelectorAll('[data-rx-time-segment]')).map((element) =>
        element.getAttribute('data-rx-time-segment'),
      ),
    ).toEqual(['hour', 'minute', 'dayPeriod'])
  })

  it('lets hour12 override the locale in both directions', async () => {
    const forced = await render(<TimeInput label="Time" locale="en-GB" hour12 />)
    expect(forced.container.querySelector('[data-rx-time-segment="dayPeriod"]')).not.toBeNull()

    const suppressed = await render(<TimeInput label="Time" locale="en-US" hour12={false} />)
    expect(suppressed.container.querySelector('[data-rx-time-segment="dayPeriod"]')).toBeNull()
  })

  it('adds seconds when asked', async () => {
    const { container } = await render(<TimeInput label="Time" locale="en-GB" showSeconds />)
    expect(seg(container, 'second')).not.toBeNull()
  })

  it('shows placeholders while empty', async () => {
    const { container } = await render(<TimeInput label="Time" locale="en-US" />)
    expect(text(container, 'hour')).toBe('hh')
    expect(text(container, 'minute')).toBe('mm')
    expect(text(container, 'dayPeriod')).toBe('--')
  })

  it('pads and displays a value on the right clock', async () => {
    const twelve = await render(<TimeInput label="Time" locale="en-US" defaultValue="14:05" />)
    expect(text(twelve.container, 'hour')).toBe('02')
    expect(text(twelve.container, 'minute')).toBe('05')
    expect(text(twelve.container, 'dayPeriod')).toBe('PM')

    const twentyFour = await render(<TimeInput label="Time" locale="en-GB" defaultValue="14:05" />)
    expect(text(twentyFour.container, 'hour')).toBe('14')
  })
})

describe('typing', () => {
  it('fills a 24-hour time digit by digit with auto-advance', async () => {
    const onChange = vi.fn()
    const { container } = await render(
      <TimeInput label="Time" locale="en-GB" onChange={onChange} />,
    )
    seg(container, 'hour').focus()
    await userEvent.keyboard('1430')
    expect(text(container, 'hour')).toBe('14')
    expect(text(container, 'minute')).toBe('30')
    expect(onChange).toHaveBeenLastCalledWith('14:30')
  })

  it('advances early when no further digit could keep the value in range', async () => {
    const { container } = await render(<TimeInput label="Time" locale="en-GB" />)
    seg(container, 'hour').focus()
    // 3 cannot become 30-something in a 0-23 hour.
    await userEvent.keyboard('3')
    expect(text(container, 'hour')).toBe('03')
    expect(document.activeElement).toBe(seg(container, 'minute'))
  })

  it('waits for a second digit when one could still follow', async () => {
    const { container } = await render(<TimeInput label="Time" locale="en-GB" />)
    seg(container, 'hour').focus()
    await userEvent.keyboard('1')
    expect(document.activeElement).toBe(seg(container, 'hour'))
    await userEvent.keyboard('9')
    expect(text(container, 'hour')).toBe('19')
  })

  it('restarts rather than rejecting when a second digit would overflow', async () => {
    const { container } = await render(<TimeInput label="Time" locale="en-US" />)
    seg(container, 'hour').focus()
    // 1 then 9 on a 12-hour clock means nine o'clock.
    await userEvent.keyboard('19')
    expect(text(container, 'hour')).toBe('09')
  })

  it('treats a leading zero as intermediate on a 12-hour clock', async () => {
    const { container } = await render(<TimeInput label="Time" locale="en-US" />)
    seg(container, 'hour').focus()
    await userEvent.keyboard('0')
    // 0 is not an hour on a 12-hour clock.
    expect(text(container, 'hour')).toBe('hh')
    await userEvent.keyboard('9')
    expect(text(container, 'hour')).toBe('09')
  })

  it('accepts 0 directly on a 24-hour clock, where it is midnight', async () => {
    const { container } = await render(<TimeInput label="Time" locale="en-GB" />)
    seg(container, 'hour').focus()
    await userEvent.keyboard('00')
    expect(text(container, 'hour')).toBe('00')
  })
})

describe('the day period', () => {
  it('takes a and p from the keyboard', async () => {
    const onChange = vi.fn()
    const { container } = await render(
      <TimeInput label="Time" locale="en-US" defaultValue="09:30" onChange={onChange} />,
    )
    seg(container, 'dayPeriod').focus()
    await userEvent.keyboard('p')
    expect(text(container, 'dayPeriod')).toBe('PM')
    expect(onChange).toHaveBeenLastCalledWith('21:30')
    await userEvent.keyboard('a')
    expect(onChange).toHaveBeenLastCalledWith('09:30')
  })

  it('toggles with the arrow keys', async () => {
    const { container } = await render(
      <TimeInput label="Time" locale="en-US" defaultValue="09:30" />,
    )
    seg(container, 'dayPeriod').focus()
    await userEvent.keyboard('{ArrowUp}')
    expect(text(container, 'dayPeriod')).toBe('PM')
    await userEvent.keyboard('{ArrowUp}')
    // Two states, so up wraps straight back.
    expect(text(container, 'dayPeriod')).toBe('AM')
  })

  it('keeps the hour on the clock face when the period changes', async () => {
    // 12 AM is 00:00 and 12 PM is 12:00 — the wrap everyone gets wrong.
    const onChange = vi.fn()
    const { container } = await render(
      <TimeInput label="Time" locale="en-US" defaultValue="00:15" onChange={onChange} />,
    )
    expect(text(container, 'hour')).toBe('12')
    expect(text(container, 'dayPeriod')).toBe('AM')
    seg(container, 'dayPeriod').focus()
    await userEvent.keyboard('p')
    expect(text(container, 'hour')).toBe('12')
    expect(onChange).toHaveBeenLastCalledWith('12:15')
  })

  it('ignores digits typed into it', async () => {
    const { container } = await render(
      <TimeInput label="Time" locale="en-US" defaultValue="09:30" />,
    )
    seg(container, 'dayPeriod').focus()
    await userEvent.keyboard('5')
    expect(text(container, 'dayPeriod')).toBe('AM')
  })
})

describe('arrow keys', () => {
  it('steps hour and minute, wrapping at the ends', async () => {
    const { container } = await render(
      <TimeInput label="Time" locale="en-GB" defaultValue="23:59" />,
    )
    seg(container, 'hour').focus()
    await userEvent.keyboard('{ArrowUp}')
    expect(text(container, 'hour')).toBe('00')
    seg(container, 'minute').focus()
    await userEvent.keyboard('{ArrowUp}')
    expect(text(container, 'minute')).toBe('00')
  })

  it('honours a minute step', async () => {
    const { container } = await render(
      <TimeInput label="Time" locale="en-GB" defaultValue="09:00" minuteStep={15} />,
    )
    seg(container, 'minute').focus()
    await userEvent.keyboard('{ArrowUp}')
    expect(text(container, 'minute')).toBe('15')
    await userEvent.keyboard('{ArrowUp}{ArrowUp}{ArrowUp}')
    // 15 -> 30 -> 45 -> wraps to 00.
    expect(text(container, 'minute')).toBe('00')
  })

  it('honours a seconds step', async () => {
    const { container } = await render(
      <TimeInput label="Time" locale="en-GB" showSeconds defaultValue="09:00:00" secondStep={30} />,
    )
    seg(container, 'second').focus()
    await userEvent.keyboard('{ArrowUp}')
    expect(text(container, 'second')).toBe('30')
  })

  it('moves focus between segments without wrapping past the ends', async () => {
    const { container } = await render(<TimeInput label="Time" locale="en-US" />)
    seg(container, 'hour').focus()
    await userEvent.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}')
    expect(document.activeElement).toBe(seg(container, 'dayPeriod'))
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}{ArrowLeft}')
    expect(document.activeElement).toBe(seg(container, 'hour'))
  })

  it('jumps to the bounds with Home and End', async () => {
    const { container } = await render(
      <TimeInput label="Time" locale="en-GB" defaultValue="09:30" />,
    )
    seg(container, 'minute').focus()
    await userEvent.keyboard('{Home}')
    expect(text(container, 'minute')).toBe('00')
    await userEvent.keyboard('{End}')
    expect(text(container, 'minute')).toBe('59')
  })

  it('leaves modified arrow keys to the browser', async () => {
    const { container } = await render(
      <TimeInput label="Time" locale="en-GB" defaultValue="09:30" />,
    )
    seg(container, 'hour').focus()
    await userEvent.keyboard('{Control>}{ArrowUp}{/Control}')
    expect(text(container, 'hour')).toBe('09')
  })
})

describe('clearing and value reporting', () => {
  it('clears a segment with Backspace and reports null', async () => {
    const onChange = vi.fn()
    const { container } = await render(
      <TimeInput label="Time" locale="en-GB" defaultValue="09:30" onChange={onChange} />,
    )
    seg(container, 'minute').focus()
    await userEvent.keyboard('{Backspace}')
    expect(text(container, 'minute')).toBe('mm')
    expect(onChange).toHaveBeenLastCalledWith(null)
  })

  it('never reports a half-typed minute', async () => {
    // Typing 30 passes through 3, and with the hour filled that is already a
    // complete time. `onChange` must wait for the number to finish.
    const onChange = vi.fn()
    const { container } = await render(
      <TimeInput label="Time" locale="en-GB" onChange={onChange} />,
    )
    seg(container, 'hour').focus()
    await userEvent.keyboard('1445')
    expect(onChange.mock.calls.map(([value]) => value)).toEqual(['14:45'])
  })

  it('offers every keystroke through onPartsChange', async () => {
    const onPartsChange = vi.fn()
    const { container } = await render(
      <TimeInput label="Time" locale="en-GB" onPartsChange={onPartsChange} />,
    )
    seg(container, 'hour').focus()
    await userEvent.keyboard('14')
    expect(onPartsChange).toHaveBeenLastCalledWith({ hour: 14, minute: null, second: null })
  })

  it('follows a controlled parent', async () => {
    function Harness() {
      const [value, setValue] = useState<string | null>('09:30')
      return (
        <>
          <TimeInput label="Time" locale="en-GB" value={value} onChange={setValue} />
          <button
            type="button"
            onClick={() => {
              setValue('17:45')
            }}
          >
            Set
          </button>
        </>
      )
    }
    const { container } = await render(<Harness />)
    await page.getByRole('button', { name: 'Set' }).click()
    expect(text(container, 'hour')).toBe('17')
    expect(text(container, 'minute')).toBe('45')
  })
})

describe('range and states', () => {
  it('marks a time outside the range but still reports it', async () => {
    const onChange = vi.fn()
    const { container } = await render(
      <TimeInput
        label="Time"
        locale="en-GB"
        min="09:00"
        max="17:00"
        onChange={onChange}
        onWarn={() => undefined}
      />,
    )
    seg(container, 'hour').focus()
    await userEvent.keyboard('2030')
    expect(onChange).toHaveBeenLastCalledWith('20:30')
    expect(container.querySelector('[data-rx-time-root]')).toHaveAttribute('data-out-of-range')
  })

  it('reports null instead when emitOutOfRange is off', async () => {
    const onChange = vi.fn()
    const { container } = await render(
      <TimeInput
        label="Time"
        locale="en-GB"
        min="09:00"
        emitOutOfRange={false}
        onChange={onChange}
        onWarn={() => undefined}
      />,
    )
    seg(container, 'hour').focus()
    await userEvent.keyboard('0730')
    expect(onChange).not.toHaveBeenCalledWith('07:30')
  })

  it('refuses input while disabled and leaves the tab order', async () => {
    const onChange = vi.fn()
    const { container } = await render(
      <TimeInput label="Time" locale="en-GB" disabled onChange={onChange} />,
    )
    expect(seg(container, 'hour')).toHaveAttribute('tabindex', '-1')
    seg(container, 'hour').focus()
    await userEvent.keyboard('14')
    expect(text(container, 'hour')).toBe('hh')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('refuses input while read-only but stays focusable', async () => {
    const { container } = await render(
      <TimeInput label="Time" locale="en-GB" readOnly defaultValue="09:30" />,
    )
    expect(seg(container, 'hour')).toHaveAttribute('tabindex', '0')
    seg(container, 'hour').focus()
    await userEvent.keyboard('{ArrowUp}')
    expect(text(container, 'hour')).toBe('09')
  })
})

describe('forms', () => {
  it('posts the 24-hour value under its name, whatever the field shows', async () => {
    let submitted: string | null = null
    await render(
      <form
        onSubmit={(event) => {
          event.preventDefault()
          const entry = new FormData(event.currentTarget).get('at')
          submitted = typeof entry === 'string' ? entry : null
        }}
      >
        <TimeInput label="At" locale="en-US" name="at" defaultValue="14:30" />
        <button type="submit">Save</button>
      </form>,
    )
    await page.getByRole('button', { name: 'Save' }).click()
    // The field shows "02:30 PM"; the form gets 24-hour.
    expect(submitted).toBe('14:30')
  })

  it('emits no hidden input without a name', async () => {
    const { container } = await render(<TimeInput label="Time" locale="en-GB" />)
    expect(container.querySelector('[data-rx-time-value]')).toBeNull()
  })

  it('fires onBlur only when focus leaves the whole field', async () => {
    const onBlur = vi.fn()
    const { container } = await render(
      <>
        <TimeInput label="Time" locale="en-GB" onBlur={onBlur} />
        <button type="button">Elsewhere</button>
      </>,
    )
    seg(container, 'hour').focus()
    seg(container, 'minute').focus()
    expect(onBlur).not.toHaveBeenCalled()
    await page.getByRole('button', { name: 'Elsewhere' }).click()
    expect(onBlur).toHaveBeenCalledTimes(1)
  })
})

describe('dir', () => {
  it('lays the field out right-to-left without reordering the segments', async () => {
    // Direction and segment order are different questions: the order comes from
    // the locale, so `dir` must move the box without touching what is in it.
    const { container } = await render(<TimeInput label="Time" locale="en-GB" dir="rtl" />)
    const root = container.querySelector<HTMLElement>('[data-rx-time-root]')!

    expect(getComputedStyle(root).direction).toBe('rtl')
    expect(
      Array.from(container.querySelectorAll('[data-rx-time-segment]')).map((node) =>
        node.getAttribute('data-rx-time-segment'),
      ),
    ).toEqual(['hour', 'minute'])
  })
})
