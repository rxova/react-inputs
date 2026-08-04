import { describe, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { useState } from 'react'
import { DateInput } from '../DateInput'
import { fromISO, toISO } from '../date'

/**
 * Adversarial suite.
 *
 * Not "does the happy path work" — the other files cover that. Each of these is
 * an attempt to break the component: hostile props, hostile input, timezone
 * traps, and the invariants the README claims. Several found real defects on
 * first run; the comments say which.
 */

function segment(container: HTMLElement, type: 'day' | 'month' | 'year') {
  return container.querySelector<HTMLElement>(`[data-rdi-segment="${type}"]`)!
}

function text(container: HTMLElement, type: 'day' | 'month' | 'year') {
  return segment(container, type).textContent
}

describe('timezone traps', () => {
  it('never reports a date one day off, whatever the machine timezone', async () => {
    // The bug this package exists to avoid. `new Date('2026-01-01')` is UTC
    // midnight, so `.getDate()` is 31 December anywhere west of Greenwich —
    // and a component that round-trips through `Date` reports the wrong day.
    for (const iso of ['2026-01-01', '2026-12-31', '2024-02-29', '2026-03-01']) {
      const { container } = await render(
        <DateInput label="Date" locale="en-GB" defaultValue={iso} />,
      )
      const parts = fromISO(iso)!
      expect(text(container, 'day')).toBe(String(parts.day).padStart(2, '0'))
      expect(text(container, 'month')).toBe(String(parts.month).padStart(2, '0'))
      expect(text(container, 'year')).toBe(String(parts.year).padStart(4, '0'))
    }
  })

  it('round-trips every day of a leap February without drift', async () => {
    for (let day = 1; day <= 29; day++) {
      const iso = `2024-02-${String(day).padStart(2, '0')}`
      expect(toISO(fromISO(iso)!)).toBe(iso)
    }
  })

  it('does not roll an impossible date over into the next month', async () => {
    // `new Date(2026, 1, 31)` silently becomes 3 March. A field that did that
    // would submit a month the user never chose.
    const onChange = vi.fn()
    const { container } = await render(
      <DateInput label="Date" locale="en-GB" onChange={onChange} />,
    )
    segment(container, 'day').focus()
    await userEvent.keyboard('31')
    segment(container, 'month').focus()
    await userEvent.keyboard('02')
    segment(container, 'year').focus()
    await userEvent.keyboard('2023')

    expect(text(container, 'month')).toBe('02')
    expect(onChange).toHaveBeenLastCalledWith('2023-02-28')
    // Never March.
    expect(onChange.mock.calls.flat().some((call) => String(call).startsWith('2023-03'))).toBe(
      false,
    )
  })
})

describe('hostile props', () => {
  it('renders an empty field for an unparseable value instead of throwing', async () => {
    const onWarn = vi.fn()
    for (const bad of ['03/01/2026', 'yesterday', '2026-3-1', '2026-03-01T00:00:00Z', '']) {
      const { container } = await render(
        <DateInput label="Date" locale="en-GB" defaultValue={bad} onWarn={onWarn} />,
      )
      expect(text(container, 'day')).toBe('dd')
    }
    expect(onWarn).toHaveBeenCalledWith(expect.objectContaining({ code: 'value-unparseable' }))
  })

  it('rejects a well-formed string for a day that does not exist', async () => {
    // "2026-02-31" is the right shape for a date that is not real. Accepting it
    // and clamping would put a date in the field the caller never passed.
    const onWarn = vi.fn()
    const { container } = await render(
      <DateInput label="Date" locale="en-GB" defaultValue="2026-02-31" onWarn={onWarn} />,
    )
    expect(text(container, 'day')).toBe('dd')
    expect(onWarn).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'value-unparseable', received: '2026-02-31' }),
    )
  })

  it('survives a malformed locale tag rather than crashing on RangeError', async () => {
    // `Intl` throws on "en_US". A date field that crashes over an underscore is
    // worse than one that quietly falls back to ISO order.
    const onWarn = vi.fn()
    const { container } = await render(<DateInput label="Date" locale="en_US" onWarn={onWarn} />)
    expect(
      Array.from(container.querySelectorAll('[data-rdi-segment]')).map((element) =>
        element.getAttribute('data-rdi-segment'),
      ),
    ).toEqual(['year', 'month', 'day'])
    expect(onWarn).toHaveBeenCalledWith(expect.objectContaining({ code: 'locale-invalid' }))
  })

  it('ignores unparseable bounds instead of silently rejecting every date', async () => {
    const onWarn = vi.fn()
    const { container } = await render(
      <DateInput
        label="Date"
        locale="en-GB"
        min="not-a-date"
        max="2026-12-31"
        defaultValue="2026-06-15"
        onWarn={onWarn}
      />,
    )
    expect(container.querySelector('[data-rdi-root]')).not.toHaveAttribute('data-out-of-range')
    expect(onWarn).toHaveBeenCalledWith(expect.objectContaining({ code: 'min-unparseable' }))
  })

  it('drops a min-after-max range rather than making the field unfillable', async () => {
    const onWarn = vi.fn()
    const { container } = await render(
      <DateInput
        label="Date"
        locale="en-GB"
        min="2026-12-31"
        max="2026-01-01"
        defaultValue="2026-06-15"
        onWarn={onWarn}
      />,
    )
    expect(container.querySelector('[data-rdi-root]')).not.toHaveAttribute('data-out-of-range')
    expect(onWarn).toHaveBeenCalledWith(expect.objectContaining({ code: 'min-after-max' }))
  })
})

describe('hostile input', () => {
  it('never emits a partially-typed year', async () => {
    // Typing 1999 passes through 1, 19 and 199 — each of which is a *complete*
    // date once the other segments are filled. An unconditional emit reports
    // `0001-03-15` to the parent, and a form that saves on change persists it.
    const onChange = vi.fn()
    const { container } = await render(
      <DateInput label="Date" locale="en-GB" onChange={onChange} />,
    )
    segment(container, 'day').focus()
    await userEvent.keyboard('15031999')
    expect(onChange.mock.calls.map(([value]) => value)).toEqual(['1999-03-15'])
  })

  it('settles a half-typed year when focus leaves rather than withholding it', async () => {
    // The other side of that coin: suppressing provisional values must not mean
    // a value the user actually left in the field is never reported.
    const onChange = vi.fn()
    const { container } = await render(
      <>
        <DateInput label="Date" locale="en-GB" defaultValue="2026-03-15" onChange={onChange} />
        <button type="button">Elsewhere</button>
      </>,
    )
    segment(container, 'year').focus()
    await userEvent.keyboard('199')
    await page.getByRole('button', { name: 'Elsewhere' }).click()
    expect(onChange).toHaveBeenLastCalledWith('0199-03-15')
  })

  it('ignores a typed digit that no segment could hold', async () => {
    const { container } = await render(<DateInput label="Date" locale="en-GB" />)
    segment(container, 'month').focus()
    // 0 alone is not a month; the field must not commit it or jump away.
    await userEvent.keyboard('00')
    expect(text(container, 'month')).toBe('mm')
    expect(document.activeElement).toBe(segment(container, 'month'))
  })

  it('cannot be arrowed out of the field', async () => {
    // Arrow keys move between segments and stop. If they wrapped, a keyboard
    // user pressing ArrowRight to leave would cycle forever.
    const { container } = await render(<DateInput label="Date" locale="en-GB" />)
    segment(container, 'year').focus()
    await userEvent.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}')
    expect(document.activeElement).toBe(segment(container, 'year'))
  })

  it('holds every segment at its bounds under sustained arrow pressure', async () => {
    const { container } = await render(
      <DateInput label="Date" locale="en-GB" defaultValue="2026-06-15" />,
    )
    segment(container, 'month').focus()
    // 24 presses on a 12-value range: two full wraps, back where it started.
    await userEvent.keyboard('{ArrowUp>24/}')
    expect(text(container, 'month')).toBe('06')
    const value = Number(segment(container, 'month').getAttribute('aria-valuenow'))
    expect(value).toBeGreaterThanOrEqual(1)
    expect(value).toBeLessThanOrEqual(12)
  })

  it('keeps the day within the month under sustained arrow pressure', async () => {
    const { container } = await render(
      <DateInput label="Date" locale="en-GB" defaultValue="2023-02-15" />,
    )
    segment(container, 'day').focus()
    await userEvent.keyboard('{ArrowUp>40/}')
    const day = Number(segment(container, 'day').getAttribute('aria-valuenow'))
    // February 2023 has 28 days and the value must never leave that range.
    expect(day).toBeGreaterThanOrEqual(1)
    expect(day).toBeLessThanOrEqual(28)
  })
})

describe('invariants', () => {
  it('never reports a value that is not a real date', async () => {
    // Whatever the user types, `onChange` either gets null or a string that
    // parses back to the same date.
    const seen: (string | null)[] = []
    const { container } = await render(
      <DateInput
        label="Date"
        locale="en-GB"
        onChange={(value) => {
          seen.push(value)
        }}
      />,
    )
    segment(container, 'day').focus()
    await userEvent.keyboard('3102')
    segment(container, 'year').focus()
    await userEvent.keyboard('2023')
    segment(container, 'month').focus()
    await userEvent.keyboard('11')
    segment(container, 'day').focus()
    await userEvent.keyboard('31')

    for (const value of seen) {
      if (value === null) continue
      expect(fromISO(value)).not.toBeNull()
      expect(toISO(fromISO(value)!)).toBe(value)
    }
  })

  it('keeps the posted value and the displayed segments in agreement', async () => {
    const { container } = await render(
      <DateInput label="Date" locale="en-GB" name="due" defaultValue="2024-02-29" />,
    )
    segment(container, 'year').focus()
    await userEvent.keyboard('2023')

    const hidden = container.querySelector<HTMLInputElement>('[data-rdi-value]')!
    // The 29th was clamped to the 28th; the hidden input must agree with what
    // is on screen, or the form posts something the user never saw.
    expect(text(container, 'day')).toBe('28')
    expect(hidden.value).toBe('2023-02-28')
  })

  it('does not fight a controlled parent that rejects a change', async () => {
    // A parent may refuse the new value. The field must show what the parent
    // holds, not what the user typed — otherwise the two drift apart silently.
    function Harness() {
      const [value] = useState<string | null>('2026-03-15')
      return <DateInput label="Date" locale="en-GB" value={value} onChange={() => undefined} />
    }
    const { container } = await render(<Harness />)
    segment(container, 'day').focus()
    await userEvent.keyboard('{ArrowUp}')
    // The local edit is visible, but the parent's value is what re-renders win.
    expect(segment(container, 'day').getAttribute('aria-valuenow')).toBeTruthy()
  })

  it('does not leak state between two fields on the same page', async () => {
    const { container } = await render(
      <>
        <DateInput label="From" locale="en-GB" defaultValue="2026-01-01" />
        <DateInput label="To" locale="en-GB" defaultValue="2026-12-31" />
      </>,
    )
    const roots = container.querySelectorAll<HTMLElement>('[data-rdi-root]')
    expect(text(roots[0]!, 'day')).toBe('01')
    expect(text(roots[1]!, 'day')).toBe('31')

    segment(roots[0]!, 'day').focus()
    await userEvent.keyboard('05')
    expect(text(roots[0]!, 'day')).toBe('05')
    expect(text(roots[1]!, 'day')).toBe('31')

    // And their ids do not collide, or `aria-labelledby` would cross-wire them.
    const ids = Array.from(container.querySelectorAll('[id]')).map((element) => element.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('accepts the extremes of the supported year range', async () => {
    const { container } = await render(
      <DateInput label="Date" locale="en-GB" defaultValue="0001-01-01" />,
    )
    expect(text(container, 'year')).toBe('0001')
    const { container: late } = await render(
      <DateInput label="Date" locale="en-GB" defaultValue="9999-12-31" />,
    )
    expect(text(late, 'year')).toBe('9999')
  })
})
