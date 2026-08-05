import { describe, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { useState } from 'react'
import { DateInput } from '../DateInput'

/**
 * Chromium, not jsdom. Everything here depends on real focus movement between
 * sibling elements — auto-advance, `relatedTarget` on blur, and the roving tab
 * order — none of which jsdom models faithfully enough to be worth asserting.
 */

function segment(container: HTMLElement, type: 'day' | 'month' | 'year') {
  return container.querySelector<HTMLElement>(`[data-rx-date-segment="${type}"]`)!
}

function text(container: HTMLElement, type: 'day' | 'month' | 'year') {
  return segment(container, type).textContent
}

describe('layout', () => {
  it('orders the segments by locale', async () => {
    const us = await render(<DateInput label="Date" locale="en-US" />)
    expect(
      Array.from(us.container.querySelectorAll('[data-rx-date-segment]')).map((element) =>
        element.getAttribute('data-rx-date-segment'),
      ),
    ).toEqual(['month', 'day', 'year'])

    const gb = await render(<DateInput label="Date" locale="en-GB" />)
    expect(
      Array.from(gb.container.querySelectorAll('[data-rx-date-segment]')).map((element) =>
        element.getAttribute('data-rx-date-segment'),
      ),
    ).toEqual(['day', 'month', 'year'])
  })

  it('shows placeholders while empty', async () => {
    const { container } = await render(<DateInput label="Date" locale="en-GB" />)
    expect(text(container, 'day')).toBe('dd')
    expect(text(container, 'month')).toBe('mm')
    expect(text(container, 'year')).toBe('yyyy')
    expect(segment(container, 'day')).toHaveAttribute('data-placeholder')
  })

  it('accepts custom placeholders', async () => {
    const { container } = await render(
      <DateInput label="Date" locale="en-GB" placeholders={{ day: 'DD', year: 'YYYY' }} />,
    )
    expect(text(container, 'day')).toBe('DD')
    expect(text(container, 'year')).toBe('YYYY')
    // Unspecified segments keep their default.
    expect(text(container, 'month')).toBe('mm')
  })

  it('pads a value to the segment width', async () => {
    const { container } = await render(
      <DateInput label="Date" locale="en-GB" defaultValue="0007-03-01" />,
    )
    expect(text(container, 'day')).toBe('01')
    expect(text(container, 'month')).toBe('03')
    expect(text(container, 'year')).toBe('0007')
  })
})

describe('typing', () => {
  it('fills a date digit by digit and auto-advances', async () => {
    const onChange = vi.fn()
    const { container } = await render(
      <DateInput label="Date" locale="en-GB" onChange={onChange} />,
    )
    segment(container, 'day').focus()
    await userEvent.keyboard('15031999')

    expect(text(container, 'day')).toBe('15')
    expect(text(container, 'month')).toBe('03')
    expect(text(container, 'year')).toBe('1999')
    expect(onChange).toHaveBeenLastCalledWith('1999-03-15')
  })

  it('advances early when no further digit could keep the value in range', async () => {
    // `4` in a two-digit day can only ever be the 4th, so the field moves on
    // rather than making the user wait or press an extra key.
    const { container } = await render(<DateInput label="Date" locale="en-GB" />)
    segment(container, 'day').focus()
    await userEvent.keyboard('4')
    expect(text(container, 'day')).toBe('04')
    expect(document.activeElement).toBe(segment(container, 'month'))
  })

  it('waits for a second digit when one could still follow', async () => {
    const { container } = await render(<DateInput label="Date" locale="en-GB" />)
    segment(container, 'day').focus()
    await userEvent.keyboard('1')
    expect(text(container, 'day')).toBe('01')
    // 1 could still become 12 or 19, so focus stays put.
    expect(document.activeElement).toBe(segment(container, 'day'))
    await userEvent.keyboard('9')
    expect(text(container, 'day')).toBe('19')
  })

  it('restarts rather than rejecting when a second digit would overflow', async () => {
    // 1 then 9 in a month means the user wants September, not the 19th month.
    const { container } = await render(<DateInput label="Date" locale="en-GB" />)
    segment(container, 'month').focus()
    await userEvent.keyboard('19')
    expect(text(container, 'month')).toBe('09')
  })

  it('treats a leading zero as an intermediate state, not a value', async () => {
    const { container } = await render(<DateInput label="Date" locale="en-GB" />)
    segment(container, 'month').focus()
    await userEvent.keyboard('0')
    // 0 is not a month, so nothing is committed yet.
    expect(text(container, 'month')).toBe('mm')
    await userEvent.keyboard('5')
    expect(text(container, 'month')).toBe('05')
  })

  it('starts a fresh number when focus leaves and returns', async () => {
    const { container } = await render(<DateInput label="Date" locale="en-GB" />)
    segment(container, 'year').focus()
    await userEvent.keyboard('19')
    segment(container, 'day').focus()
    segment(container, 'year').focus()
    await userEvent.keyboard('2')
    // Not 192 — the buffer was reset on focus.
    expect(text(container, 'year')).toBe('0002')
  })
})

describe('arrow keys', () => {
  it('steps a segment up and down', async () => {
    const { container } = await render(
      <DateInput label="Date" locale="en-GB" defaultValue="2026-03-15" />,
    )
    segment(container, 'day').focus()
    await userEvent.keyboard('{ArrowUp}')
    expect(text(container, 'day')).toBe('16')
    await userEvent.keyboard('{ArrowDown}{ArrowDown}')
    expect(text(container, 'day')).toBe('14')
  })

  it('wraps at the ends of a segment', async () => {
    const { container } = await render(
      <DateInput label="Date" locale="en-GB" defaultValue="2026-12-31" />,
    )
    segment(container, 'month').focus()
    await userEvent.keyboard('{ArrowUp}')
    expect(text(container, 'month')).toBe('01')
    await userEvent.keyboard('{ArrowDown}')
    expect(text(container, 'month')).toBe('12')
  })

  it('lands on the start value on the first press of an empty segment', async () => {
    const { container } = await render(<DateInput label="Date" locale="en-GB" />)
    segment(container, 'month').focus()
    await userEvent.keyboard('{ArrowUp}')
    // 01, not 02 — the first press should select the first value, not step past it.
    expect(text(container, 'month')).toBe('01')
  })

  it('starts an empty year at the current one', async () => {
    const { container } = await render(<DateInput label="Date" locale="en-GB" />)
    segment(container, 'year').focus()
    await userEvent.keyboard('{ArrowUp}')
    expect(text(container, 'year')).toBe(String(new Date().getFullYear()))
  })

  it('moves focus between segments without wrapping past the ends', async () => {
    const { container } = await render(<DateInput label="Date" locale="en-GB" />)
    segment(container, 'day').focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(document.activeElement).toBe(segment(container, 'month'))
    await userEvent.keyboard('{ArrowRight}{ArrowRight}')
    // Clamped at the last segment — an arrow key must not become a way to
    // cycle forever inside the field.
    expect(document.activeElement).toBe(segment(container, 'year'))
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}{ArrowLeft}')
    expect(document.activeElement).toBe(segment(container, 'day'))
  })

  it('jumps to the bounds with Home and End', async () => {
    const { container } = await render(
      <DateInput label="Date" locale="en-GB" defaultValue="2026-03-15" />,
    )
    segment(container, 'day').focus()
    await userEvent.keyboard('{Home}')
    expect(text(container, 'day')).toBe('01')
    await userEvent.keyboard('{End}')
    expect(text(container, 'day')).toBe('31')
  })

  it('leaves modified arrow keys to the browser', async () => {
    const { container } = await render(
      <DateInput label="Date" locale="en-GB" defaultValue="2026-03-15" />,
    )
    segment(container, 'day').focus()
    await userEvent.keyboard('{Control>}{ArrowUp}{/Control}')
    expect(text(container, 'day')).toBe('15')
  })
})

describe('clearing', () => {
  it('clears one segment with Backspace', async () => {
    const onChange = vi.fn()
    const { container } = await render(
      <DateInput label="Date" locale="en-GB" defaultValue="2026-03-15" onChange={onChange} />,
    )
    segment(container, 'day').focus()
    await userEvent.keyboard('{Backspace}')
    expect(text(container, 'day')).toBe('dd')
    // The date is no longer complete, so the reported value is null.
    expect(onChange).toHaveBeenLastCalledWith(null)
  })

  it('clears with Delete too', async () => {
    const { container } = await render(
      <DateInput label="Date" locale="en-GB" defaultValue="2026-03-15" />,
    )
    segment(container, 'month').focus()
    await userEvent.keyboard('{Delete}')
    expect(text(container, 'month')).toBe('mm')
  })
})

describe('day re-clamping', () => {
  it('pulls the day back when the month can no longer hold it', async () => {
    const { container } = await render(<DateInput label="Date" locale="en-GB" />)
    segment(container, 'day').focus()
    await userEvent.keyboard('31')
    expect(text(container, 'day')).toBe('31')
    // Now choose February.
    await userEvent.keyboard('02')
    expect(text(container, 'month')).toBe('02')
    // 29, not a rollover into March: with no year yet, a leap year is still
    // possible, so narrowing to 28 here would reject a 29 about to be valid.
    expect(text(container, 'day')).toBe('29')
    // Once the year rules a leap year out, it settles at 28.
    await userEvent.keyboard('2023')
    expect(text(container, 'day')).toBe('28')
  })

  it('allows the 29th of February in a leap year and clamps it out of one', async () => {
    const { container } = await render(
      <DateInput label="Date" locale="en-GB" defaultValue="2024-02-29" />,
    )
    expect(text(container, 'day')).toBe('29')
    segment(container, 'year').focus()
    await userEvent.keyboard('2023')
    expect(text(container, 'day')).toBe('28')
  })

  it('accepts a 29 typed into February before the year is known', async () => {
    const { container } = await render(<DateInput label="Date" locale="en-GB" />)
    segment(container, 'day').focus()
    await userEvent.keyboard('2902')
    expect(text(container, 'day')).toBe('29')
    expect(text(container, 'month')).toBe('02')
  })
})

describe('value reporting', () => {
  it('reports only complete dates, never a half-typed one', async () => {
    const onChange = vi.fn()
    const { container } = await render(
      <DateInput label="Date" locale="en-GB" onChange={onChange} />,
    )
    segment(container, 'day').focus()
    await userEvent.keyboard('1503')
    expect(onChange).not.toHaveBeenCalled()
    await userEvent.keyboard('1999')
    expect(onChange).toHaveBeenCalledExactlyOnceWith('1999-03-15')
  })

  it('offers every keystroke through onPartsChange', async () => {
    const onPartsChange = vi.fn()
    const { container } = await render(
      <DateInput label="Date" locale="en-GB" onPartsChange={onPartsChange} />,
    )
    segment(container, 'day').focus()
    await userEvent.keyboard('15')
    expect(onPartsChange).toHaveBeenLastCalledWith({ year: null, month: null, day: 15 })
  })

  it('follows the parent when controlled', async () => {
    function Harness() {
      const [value, setValue] = useState<string | null>('2026-03-15')
      return (
        <>
          <DateInput label="Date" locale="en-GB" value={value} onChange={setValue} />
          <button
            type="button"
            onClick={() => {
              setValue('2020-01-02')
            }}
          >
            Set
          </button>
          <output data-testid="mirror">{value ?? 'empty'}</output>
        </>
      )
    }
    const { container } = await render(<Harness />)
    expect(text(container, 'day')).toBe('15')
    await page.getByRole('button', { name: 'Set' }).click()
    expect(text(container, 'day')).toBe('02')
    expect(text(container, 'month')).toBe('01')
    expect(text(container, 'year')).toBe('2020')
  })

  it('empties when a controlled value becomes null', async () => {
    function Harness() {
      const [value, setValue] = useState<string | null>('2026-03-15')
      return (
        <>
          <DateInput label="Date" locale="en-GB" value={value} onChange={setValue} />
          <button
            type="button"
            onClick={() => {
              setValue(null)
            }}
          >
            Clear
          </button>
        </>
      )
    }
    const { container } = await render(<Harness />)
    await page.getByRole('button', { name: 'Clear' }).click()
    expect(text(container, 'day')).toBe('dd')
  })
})

describe('range', () => {
  it('marks a date outside the range invalid but still reports it', async () => {
    const onChange = vi.fn()
    const { container } = await render(
      <DateInput
        label="Date"
        locale="en-GB"
        min="2026-01-01"
        max="2026-12-31"
        onChange={onChange}
        onWarn={() => undefined}
      />,
    )
    segment(container, 'day').focus()
    await userEvent.keyboard('15031999')
    // Reported, not swallowed: a field that silently drops what you typed is
    // indistinguishable from one that accepted it.
    expect(onChange).toHaveBeenLastCalledWith('1999-03-15')
    expect(container.querySelector('[data-rx-date-root]')).toHaveAttribute('data-out-of-range')
    expect(segment(container, 'day')).toHaveAttribute('aria-invalid', 'true')
  })

  it('reports null instead when emitOutOfRange is off', async () => {
    const onChange = vi.fn()
    const { container } = await render(
      <DateInput
        label="Date"
        locale="en-GB"
        min="2026-01-01"
        emitOutOfRange={false}
        onChange={onChange}
        onWarn={() => undefined}
      />,
    )
    segment(container, 'day').focus()
    await userEvent.keyboard('15031999')
    expect(onChange).not.toHaveBeenCalledWith('1999-03-15')
  })

  it('drops an impossible range rather than enforcing it', async () => {
    const { container } = await render(
      <DateInput
        label="Date"
        locale="en-GB"
        min="2026-12-31"
        max="2026-01-01"
        defaultValue="2026-06-15"
        onWarn={() => undefined}
      />,
    )
    // Neither bound applies, so a date between them is not marked invalid.
    expect(container.querySelector('[data-rx-date-root]')).not.toHaveAttribute('data-out-of-range')
  })
})

describe('states', () => {
  it('refuses input while disabled and leaves the tab order', async () => {
    const onChange = vi.fn()
    const { container } = await render(
      <DateInput label="Date" locale="en-GB" disabled onChange={onChange} />,
    )
    expect(segment(container, 'day')).toHaveAttribute('tabindex', '-1')
    segment(container, 'day').focus()
    await userEvent.keyboard('15')
    expect(text(container, 'day')).toBe('dd')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('refuses input while read-only but stays focusable', async () => {
    const { container } = await render(
      <DateInput label="Date" locale="en-GB" readOnly defaultValue="2026-03-15" />,
    )
    expect(segment(container, 'day')).toHaveAttribute('tabindex', '0')
    segment(container, 'day').focus()
    await userEvent.keyboard('{ArrowUp}')
    expect(text(container, 'day')).toBe('15')
  })
})

describe('forms', () => {
  it('posts the ISO value under its name', async () => {
    let submitted: string | null = null
    await render(
      <form
        onSubmit={(event) => {
          event.preventDefault()
          const entry = new FormData(event.currentTarget).get('due')
          submitted = typeof entry === 'string' ? entry : null
        }}
      >
        <DateInput label="Due" locale="en-GB" name="due" defaultValue="2026-03-15" />
        <button type="submit">Save</button>
      </form>,
    )
    await page.getByRole('button', { name: 'Save' }).click()
    expect(submitted).toBe('2026-03-15')
  })

  it('posts an empty string while the date is incomplete', async () => {
    let submitted: string | null = null
    const { container } = await render(
      <form
        onSubmit={(event) => {
          event.preventDefault()
          const entry = new FormData(event.currentTarget).get('due')
          submitted = typeof entry === 'string' ? entry : null
        }}
      >
        <DateInput label="Due" locale="en-GB" name="due" />
        <button type="submit">Save</button>
      </form>,
    )
    segment(container, 'day').focus()
    await userEvent.keyboard('15')
    await page.getByRole('button', { name: 'Save' }).click()
    expect(submitted).toBe('')
  })

  it('emits no hidden input without a name', async () => {
    const { container } = await render(<DateInput label="Date" locale="en-GB" />)
    expect(container.querySelector('[data-rx-date-value]')).toBeNull()
  })

  it('fires onBlur only when focus leaves the whole field', async () => {
    const onBlur = vi.fn()
    const { container } = await render(
      <>
        <DateInput label="Date" locale="en-GB" onBlur={onBlur} />
        <button type="button">Elsewhere</button>
      </>,
    )
    segment(container, 'day').focus()
    segment(container, 'month').focus()
    // Moving between segments is still inside the field.
    expect(onBlur).not.toHaveBeenCalled()

    await page.getByRole('button', { name: 'Elsewhere' }).click()
    expect(onBlur).toHaveBeenCalledTimes(1)
  })
})

describe('dir', () => {
  it('lays the field out right-to-left without reordering the segments', async () => {
    // Direction and segment order are different questions. The order comes from
    // the locale — a Hebrew page showing an en-GB date still wants day, month,
    // year — so `dir` must move the box without touching what is in it.
    const { container } = await render(<DateInput label="Date" locale="en-GB" dir="rtl" />)
    const root = container.querySelector<HTMLElement>('[data-rx-date-root]')!

    expect(getComputedStyle(root).direction).toBe('rtl')
    expect(
      Array.from(container.querySelectorAll('[data-rx-date-segment]')).map((node) =>
        node.getAttribute('data-rx-date-segment'),
      ),
    ).toEqual(['day', 'month', 'year'])
  })
})
