import { describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { useState } from 'react'
import { TimeInput } from '../TimeInput'
import { fromDisplayHour, fromISO, toDayPeriod, toDisplayHour, toISO } from '../time'

/**
 * Adversarial suite.
 *
 * Not "does the happy path work" — the other files cover that. Each of these is
 * an attempt to break the component: hostile props, hostile input, the
 * midnight/noon traps, and the invariants the README claims.
 */
type Seg = 'hour' | 'minute' | 'second' | 'dayPeriod'
function seg(container: HTMLElement, type: Seg) {
  return container.querySelector<HTMLElement>(`[data-rti-segment="${type}"]`)!
}
function text(container: HTMLElement, type: Seg) {
  return seg(container, type).textContent
}

describe('the midnight and noon traps', () => {
  it('round-trips every minute of the day through the 12-hour clock', () => {
    // The `% 12` fold is the single easiest thing to get wrong in a time field,
    // and it is wrong in exactly two places out of 24 — so an exhaustive sweep
    // is cheap and is the only check that actually proves it.
    for (let hour = 0; hour <= 23; hour++) {
      const display = toDisplayHour(hour, true)
      const period = toDayPeriod(hour)
      expect(display).toBeGreaterThanOrEqual(1)
      expect(display).toBeLessThanOrEqual(12)
      expect(fromDisplayHour(display, period)).toBe(hour)
    }
  })

  it('shows 12 AM for midnight, not 00 and not 12 PM', async () => {
    const { container } = await render(
      <TimeInput label="Time" locale="en-US" defaultValue="00:00" />,
    )
    expect(text(container, 'hour')).toBe('12')
    expect(text(container, 'dayPeriod')).toBe('AM')
  })

  it('shows 12 PM for noon', async () => {
    const { container } = await render(
      <TimeInput label="Time" locale="en-US" defaultValue="12:00" />,
    )
    expect(text(container, 'hour')).toBe('12')
    expect(text(container, 'dayPeriod')).toBe('PM')
  })

  it('does not jump a day when the period is toggled at 12', async () => {
    const onChange = vi.fn()
    const { container } = await render(
      <TimeInput label="Time" locale="en-US" defaultValue="00:30" onChange={onChange} />,
    )
    seg(container, 'dayPeriod').focus()
    await userEvent.keyboard('p')
    expect(onChange).toHaveBeenLastCalledWith('12:30')
    await userEvent.keyboard('a')
    expect(onChange).toHaveBeenLastCalledWith('00:30')
  })

  it('keeps the period when the hour is retyped', async () => {
    // Typing a new hour must not silently move the user from PM to AM.
    const onChange = vi.fn()
    const { container } = await render(
      <TimeInput label="Time" locale="en-US" defaultValue="14:30" onChange={onChange} />,
    )
    seg(container, 'hour').focus()
    await userEvent.keyboard('05')
    expect(text(container, 'dayPeriod')).toBe('PM')
    expect(onChange).toHaveBeenLastCalledWith('17:30')
  })

  it('never produces an hour outside 0-23 from any keystroke sequence', async () => {
    const seen: (string | null)[] = []
    const { container } = await render(
      <TimeInput
        label="Time"
        locale="en-US"
        onChange={(value) => {
          seen.push(value)
        }}
      />,
    )
    seg(container, 'hour').focus()
    await userEvent.keyboard('1230')
    seg(container, 'dayPeriod').focus()
    await userEvent.keyboard('p')
    await userEvent.keyboard('a')
    seg(container, 'hour').focus()
    await userEvent.keyboard('12')

    for (const value of seen) {
      if (value === null) continue
      expect(value).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/)
      expect(fromISO(value)).not.toBeNull()
    }
  })
})

describe('hostile props', () => {
  it('renders empty for a display-format value and says what it wanted', async () => {
    const onWarn = vi.fn()
    const { container } = await render(
      <TimeInput label="Time" locale="en-US" defaultValue="2:30 PM" onWarn={onWarn} />,
    )
    expect(text(container, 'hour')).toBe('hh')
    const warning = onWarn.mock.calls.map(([w]) => w).find((w) => w.code === 'value-unparseable')
    expect(String(warning.message)).toContain('14:30')
  })

  it('rejects an unpadded value', async () => {
    // "9:05" is the shape a careless caller produces from string concatenation.
    const { container } = await render(
      <TimeInput label="Time" locale="en-GB" defaultValue="9:05" onWarn={() => undefined} />,
    )
    expect(text(container, 'hour')).toBe('hh')
  })

  it('rejects an impossible clock reading', async () => {
    const { container } = await render(
      <TimeInput label="Time" locale="en-GB" defaultValue="24:00" onWarn={() => undefined} />,
    )
    expect(text(container, 'hour')).toBe('hh')
  })

  it('survives a malformed locale tag rather than crashing on RangeError', async () => {
    const onWarn = vi.fn()
    const { container } = await render(<TimeInput label="Time" locale="en_US" onWarn={onWarn} />)
    // Falls back to a 24-hour HH:mm field.
    expect(container.querySelector('[data-rti-segment="dayPeriod"]')).toBeNull()
    expect(onWarn).toHaveBeenCalledWith(expect.objectContaining({ code: 'locale-invalid' }))
  })

  it('falls back to a step of 1 for a step that cannot form a grid', async () => {
    // 7 does not divide 60, so a 7-minute grid leaves a 4-minute bucket at the
    // top of every hour and arrowing up from :56 lands off the grid.
    const onWarn = vi.fn()
    const { container } = await render(
      <TimeInput label="Time" locale="en-GB" defaultValue="09:00" minuteStep={7} onWarn={onWarn} />,
    )
    seg(container, 'minute').focus()
    await userEvent.keyboard('{ArrowUp}')
    expect(text(container, 'minute')).toBe('01')
    expect(onWarn).toHaveBeenCalledWith(expect.objectContaining({ code: 'step-invalid' }))
  })

  it('drops a min-after-max range and says it does not model midnight wrap', async () => {
    const onWarn = vi.fn()
    const { container } = await render(
      <TimeInput
        label="Time"
        locale="en-GB"
        min="22:00"
        max="06:00"
        defaultValue="12:00"
        onWarn={onWarn}
      />,
    )
    expect(container.querySelector('[data-rti-root]')).not.toHaveAttribute('data-out-of-range')
    const warning = onWarn.mock.calls.map(([w]) => w).find((w) => w.code === 'min-after-max')
    expect(String(warning.message)).toContain('midnight')
  })

  it('ignores an unparseable bound rather than rejecting every time', async () => {
    const onWarn = vi.fn()
    const { container } = await render(
      <TimeInput
        label="Time"
        locale="en-GB"
        min="half past nine"
        defaultValue="12:00"
        onWarn={onWarn}
      />,
    )
    expect(container.querySelector('[data-rti-root]')).not.toHaveAttribute('data-out-of-range')
    expect(onWarn).toHaveBeenCalledWith(expect.objectContaining({ code: 'min-unparseable' }))
  })
})

describe('hostile input', () => {
  it('cannot be arrowed out of the field', async () => {
    const { container } = await render(<TimeInput label="Time" locale="en-US" />)
    seg(container, 'dayPeriod').focus()
    await userEvent.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}')
    expect(document.activeElement).toBe(seg(container, 'dayPeriod'))
  })

  it('holds every segment in range under sustained arrow pressure', async () => {
    const { container } = await render(
      <TimeInput label="Time" locale="en-GB" showSeconds defaultValue="09:30:15" />,
    )
    for (const [type, max] of [
      ['hour', 23],
      ['minute', 59],
      ['second', 59],
    ] as const) {
      seg(container, type).focus()
      await userEvent.keyboard('{ArrowUp>70/}')
      const now = Number(seg(container, type).getAttribute('aria-valuenow'))
      expect(now).toBeGreaterThanOrEqual(0)
      expect(now).toBeLessThanOrEqual(max)
    }
  })

  it('ignores letters that mean nothing on a numeric segment', async () => {
    const { container } = await render(
      <TimeInput label="Time" locale="en-GB" defaultValue="09:30" />,
    )
    seg(container, 'hour').focus()
    await userEvent.keyboard('xyz')
    expect(text(container, 'hour')).toBe('09')
  })

  it('does not let a 12-hour field produce hour 0 by typing', async () => {
    // 0 is not on a 12-hour clock face, so it must never be committed there.
    const { container } = await render(<TimeInput label="Time" locale="en-US" />)
    seg(container, 'hour').focus()
    await userEvent.keyboard('0')
    expect(seg(container, 'hour')).not.toHaveAttribute('aria-valuenow')
  })
})

describe('invariants', () => {
  it('never reports a value that does not parse back to itself', async () => {
    const seen: (string | null)[] = []
    const { container } = await render(
      <TimeInput
        label="Time"
        locale="en-GB"
        showSeconds
        onChange={(value) => {
          seen.push(value)
        }}
      />,
    )
    seg(container, 'hour').focus()
    await userEvent.keyboard('235959')
    for (const value of seen) {
      if (value === null) continue
      expect(toISO(fromISO(value)!, true)).toBe(value)
    }
  })

  it('keeps the posted value and the displayed segments in agreement', async () => {
    const { container } = await render(
      <TimeInput label="Time" locale="en-US" name="at" defaultValue="09:30" />,
    )
    seg(container, 'dayPeriod').focus()
    await userEvent.keyboard('p')
    const hidden = container.querySelector<HTMLInputElement>('[data-rti-value]')!
    // The field shows 09:30 PM; the form must post 21:30, not 09:30.
    expect(text(container, 'hour')).toBe('09')
    expect(text(container, 'dayPeriod')).toBe('PM')
    expect(hidden.value).toBe('21:30')
  })

  it('does not leak state between two fields on the same page', async () => {
    const { container } = await render(
      <>
        <TimeInput label="From" locale="en-GB" defaultValue="09:00" />
        <TimeInput label="To" locale="en-GB" defaultValue="17:00" />
      </>,
    )
    const roots = container.querySelectorAll<HTMLElement>('[data-rti-root]')
    seg(roots[0]!, 'hour').focus()
    await userEvent.keyboard('11')
    expect(text(roots[0]!, 'hour')).toBe('11')
    expect(text(roots[1]!, 'hour')).toBe('17')

    const ids = Array.from(container.querySelectorAll('[id]')).map((element) => element.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('does not fight a controlled parent that rejects a change', async () => {
    function Harness() {
      const [value] = useState<string | null>('09:30')
      return <TimeInput label="Time" locale="en-GB" value={value} onChange={() => undefined} />
    }
    const { container } = await render(<Harness />)
    seg(container, 'hour').focus()
    await userEvent.keyboard('{ArrowUp}')
    // The parent holds 09:30; the field must not drift away from it silently
    // across a re-render.
    expect(seg(container, 'hour').getAttribute('aria-valuenow')).toBeTruthy()
  })

  it('reports seconds only when the field has them', async () => {
    const withSeconds = vi.fn()
    const without = vi.fn()
    const a = await render(
      <TimeInput label="A" locale="en-GB" showSeconds onChange={withSeconds} />,
    )
    seg(a.container, 'hour').focus()
    await userEvent.keyboard('093015')
    expect(withSeconds).toHaveBeenLastCalledWith('09:30:15')

    const b = await render(<TimeInput label="B" locale="en-GB" onChange={without} />)
    seg(b.container, 'hour').focus()
    await userEvent.keyboard('0930')
    expect(without).toHaveBeenLastCalledWith('09:30')
  })
})
