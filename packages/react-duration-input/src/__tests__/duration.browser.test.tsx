import { describe, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { useState } from 'react'
import { DurationInput } from '../DurationInput'
import type { DurationUnit } from '../duration'

/**
 * Chromium, not jsdom. Everything here depends on real focus movement between
 * sibling elements — auto-advance, `relatedTarget` on blur, the carry that runs
 * when focus leaves the field, and the tab order — none of which jsdom models
 * faithfully enough to be worth asserting.
 */

function seg(container: HTMLElement, unit: DurationUnit) {
  return container.querySelector<HTMLElement>(`[data-rx-duration-segment="${unit}"]`)!
}

function text(container: HTMLElement, unit: DurationUnit) {
  return seg(container, unit).textContent
}

function order(container: HTMLElement) {
  return Array.from(container.querySelectorAll('[data-rx-duration-segment]')).map((element) =>
    element.getAttribute('data-rx-duration-segment'),
  )
}

describe('layout', () => {
  it('shows hours and minutes by default', async () => {
    const { container } = await render(<DurationInput label="Duration" locale="en-GB" />)
    expect(order(container)).toEqual(['hour', 'minute'])
  })

  it('shows exactly the units it is given', async () => {
    const { container } = await render(
      <DurationInput label="Duration" locale="en-GB" units={['day', 'hour', 'minute', 'second']} />,
    )
    expect(order(container)).toEqual(['day', 'hour', 'minute', 'second'])
  })

  it('sorts a reversed units array rather than rendering it upside down', async () => {
    const { container } = await render(
      <DurationInput
        label="Duration"
        locale="en-GB"
        units={['minute', 'hour']}
        onWarn={() => undefined}
      />,
    )
    expect(order(container)).toEqual(['hour', 'minute'])
  })

  it('shows placeholders while empty', async () => {
    const { container } = await render(<DurationInput label="Duration" locale="en-GB" />)
    expect(text(container, 'hour')).toBe('hh')
    expect(text(container, 'minute')).toBe('mm')
  })

  it('paints the locale suffix after each segment', async () => {
    const { container } = await render(<DurationInput label="Duration" locale="de-DE" />)
    expect(container.textContent).toContain('Min.')
  })

  it('marks the leading segment so a theme can style it wider', async () => {
    const { container } = await render(<DurationInput label="Duration" locale="en-GB" />)
    expect(seg(container, 'hour').hasAttribute('data-rx-duration-leading')).toBe(true)
    expect(seg(container, 'minute').hasAttribute('data-rx-duration-leading')).toBe(false)
  })

  it('zero-pads the trailing units but not the leading one', async () => {
    const { container } = await render(
      <DurationInput label="Duration" locale="en-GB" defaultValue="PT1H5M" />,
    )
    expect(text(container, 'hour')).toBe('1')
    expect(text(container, 'minute')).toBe('05')
  })
})

describe('reading a value', () => {
  it('splits an ISO duration across the units on screen', async () => {
    const { container } = await render(
      <DurationInput
        label="Duration"
        locale="en-GB"
        units={['hour', 'minute', 'second']}
        defaultValue="PT1H30M15S"
      />,
    )
    expect([text(container, 'hour'), text(container, 'minute'), text(container, 'second')]).toEqual(
      ['1', '30', '15'],
    )
  })

  it('folds a duration into a single-unit field', async () => {
    const { container } = await render(
      <DurationInput label="Duration" locale="en-GB" units={['minute']} defaultValue="PT1H30M" />,
    )
    expect(text(container, 'minute')).toBe('90')
  })

  it('leaves the field empty for a value it cannot read', async () => {
    const { container } = await render(
      <DurationInput label="Duration" locale="en-GB" defaultValue="P1M" onWarn={() => undefined} />,
    )
    expect(text(container, 'hour')).toBe('hh')
  })
})

describe('typing', () => {
  it('fills a segment and auto-advances when it is full', async () => {
    const { container } = await render(<DurationInput label="Duration" locale="en-GB" />)
    await userEvent.click(seg(container, 'minute'))
    await userEvent.keyboard('45')
    expect(text(container, 'minute')).toBe('45')
  })

  /**
   * Width is the only thing that ends a number here, unlike the time field
   * which also advances as soon as a further digit could not stay in range.
   * It cannot: the ranges are exactly what typing is allowed to exceed.
   */
  it('advances after two digits, and only then', async () => {
    const { container } = await render(<DurationInput label="Duration" locale="en-GB" />)
    await userEvent.click(seg(container, 'hour'))
    await userEvent.keyboard('0')
    expect(document.activeElement).toBe(seg(container, 'hour'))
    await userEvent.keyboard('2')
    expect(document.activeElement).toBe(seg(container, 'minute'))
    await userEvent.keyboard('30')
    expect(text(container, 'hour')).toBe('2')
    expect(text(container, 'minute')).toBe('30')
  })

  /**
   * The rule that makes the carry reachable at all. `90` is not a legal minute
   * *component*, and it is exactly what someone types on the way to an hour and
   * a half — so the range is enforced on blur, not at the keystroke.
   */
  it('lets a bounded segment take a number above its range while typing', async () => {
    const { container } = await render(<DurationInput label="Duration" locale="en-GB" />)
    await userEvent.click(seg(container, 'minute'))
    await userEvent.keyboard('90')
    expect(text(container, 'minute')).toBe('90')
  })

  it('restarts from the new digit once the width is full', async () => {
    const { container } = await render(
      <DurationInput label="Duration" locale="en-GB" units={['minute']} />,
    )
    await userEvent.click(seg(container, 'minute'))
    await userEvent.keyboard('1234')
    // 123 fills the three digits a lone segment takes; the 4 starts over.
    expect(text(container, 'minute')).toBe('4')
  })

  /**
   * The rule this component is built around: the largest unit on screen has no
   * ceiling, because in a minutes-only field `90` is exactly what someone means.
   */
  it('lets the leading unit take a number no other segment would', async () => {
    const { container } = await render(
      <DurationInput label="Duration" locale="en-GB" units={['minute']} />,
    )
    await userEvent.click(seg(container, 'minute'))
    await userEvent.keyboard('180')
    expect(text(container, 'minute')).toBe('180')
  })

  it('reports only the finished number, never the digit on the way there', async () => {
    const onChange = vi.fn()
    const { container } = await render(
      <DurationInput label="Duration" locale="en-GB" onChange={onChange} defaultValue="PT1H0M" />,
    )
    await userEvent.click(seg(container, 'minute'))
    await userEvent.keyboard('45')
    // Not PT1H4M on the way to PT1H45M.
    expect(onChange.mock.calls.map((call) => call[0])).not.toContain('PT1H4M')
    expect(onChange).toHaveBeenLastCalledWith('PT1H45M')
  })

  it('clears a segment on Backspace and Delete', async () => {
    const { container } = await render(
      <DurationInput label="Duration" locale="en-GB" defaultValue="PT1H30M" />,
    )
    await userEvent.click(seg(container, 'minute'))
    await userEvent.keyboard('{Backspace}')
    expect(text(container, 'minute')).toBe('mm')
    await userEvent.click(seg(container, 'hour'))
    await userEvent.keyboard('{Delete}')
    expect(text(container, 'hour')).toBe('hh')
  })

  it('ignores letters entirely — there is no AM/PM here', async () => {
    const { container } = await render(<DurationInput label="Duration" locale="en-GB" />)
    await userEvent.click(seg(container, 'hour'))
    await userEvent.keyboard('abc')
    expect(text(container, 'hour')).toBe('hh')
  })
})

describe('the carry', () => {
  /**
   * Typing 90 into the minutes of an h:m field is legitimate mid-entry and
   * meaningless as a stored value. It settles when focus leaves, not while the
   * digits are still being typed.
   */
  it('carries overflow upward when focus leaves the field', async () => {
    const { container } = await render(
      <DurationInput label="Duration" locale="en-GB" defaultValue="PT0S" />,
    )
    await userEvent.click(seg(container, 'minute'))
    await userEvent.keyboard('90')
    expect(text(container, 'minute')).toBe('90')

    await userEvent.click(document.body)
    expect(text(container, 'hour')).toBe('1')
    expect(text(container, 'minute')).toBe('30')
  })

  it('does not carry while the number is still being typed', async () => {
    const { container } = await render(
      <DurationInput label="Duration" locale="en-GB" defaultValue="PT0S" />,
    )
    await userEvent.click(seg(container, 'minute'))
    await userEvent.keyboard('9')
    expect(text(container, 'minute')).toBe('09')
    expect(text(container, 'hour')).toBe('0')
  })

  it('leaves a leading unit alone, however large', async () => {
    const { container } = await render(
      <DurationInput label="Duration" locale="en-GB" units={['minute']} />,
    )
    await userEvent.click(seg(container, 'minute'))
    await userEvent.keyboard('999')
    await userEvent.click(document.body)
    expect(text(container, 'minute')).toBe('999')
  })

  it('emits the carried duration, not the one that was typed', async () => {
    const onChange = vi.fn()
    const { container } = await render(
      <DurationInput label="Duration" locale="en-GB" defaultValue="PT0S" onChange={onChange} />,
    )
    await userEvent.click(seg(container, 'minute'))
    await userEvent.keyboard('90')
    await userEvent.click(document.body)
    expect(onChange).toHaveBeenLastCalledWith('PT1H30M')
  })
})

describe('arrow keys', () => {
  it('steps up and down', async () => {
    const { container } = await render(
      <DurationInput label="Duration" locale="en-GB" defaultValue="PT1H30M" />,
    )
    await userEvent.click(seg(container, 'minute'))
    await userEvent.keyboard('{ArrowUp}')
    expect(text(container, 'minute')).toBe('31')
    await userEvent.keyboard('{ArrowDown}{ArrowDown}')
    expect(text(container, 'minute')).toBe('29')
  })

  it('lands on the minimum on the first press of an empty segment', async () => {
    const { container } = await render(<DurationInput label="Duration" locale="en-GB" />)
    await userEvent.click(seg(container, 'minute'))
    await userEvent.keyboard('{ArrowUp}')
    expect(text(container, 'minute')).toBe('00')
  })

  /**
   * The time field wraps because a clock cycles. A duration does not: arrowing
   * down from 0 minutes to 59 would silently add an hour to the value.
   */
  it('clamps at each end rather than wrapping', async () => {
    const { container } = await render(
      <DurationInput label="Duration" locale="en-GB" defaultValue="PT1H0M" />,
    )
    await userEvent.click(seg(container, 'minute'))
    await userEvent.keyboard('{ArrowDown}')
    expect(text(container, 'minute')).toBe('00')

    await userEvent.keyboard('{End}')
    expect(text(container, 'minute')).toBe('59')
    await userEvent.keyboard('{ArrowUp}')
    expect(text(container, 'minute')).toBe('59')
  })

  it('walks the step grid it is given', async () => {
    const { container } = await render(
      <DurationInput label="Duration" locale="en-GB" minuteStep={15} defaultValue="PT1H0M" />,
    )
    await userEvent.click(seg(container, 'minute'))
    await userEvent.keyboard('{ArrowUp}{ArrowUp}')
    expect(text(container, 'minute')).toBe('30')
  })

  it('gives seconds their own step and leaves days and hours on one', async () => {
    const { container } = await render(
      <DurationInput
        label="Duration"
        locale="en-GB"
        units={['day', 'hour', 'minute', 'second']}
        secondStep={30}
        defaultValue="P1DT1H0M0S"
      />,
    )
    await userEvent.click(seg(container, 'second'))
    await userEvent.keyboard('{ArrowUp}')
    expect(text(container, 'second')).toBe('30')

    await userEvent.click(seg(container, 'day'))
    await userEvent.keyboard('{ArrowUp}')
    expect(text(container, 'day')).toBe('2')

    await userEvent.click(seg(container, 'hour'))
    await userEvent.keyboard('{ArrowUp}')
    expect(text(container, 'hour')).toBe('02')
  })

  it('has nothing for End to do on an unbounded leading segment', async () => {
    const { container } = await render(
      <DurationInput label="Duration" locale="en-GB" units={['minute']} defaultValue="PT5M" />,
    )
    await userEvent.click(seg(container, 'minute'))
    await userEvent.keyboard('{End}')
    expect(text(container, 'minute')).toBe('5')
  })

  it('sends Home to zero on any segment', async () => {
    const { container } = await render(
      <DurationInput label="Duration" locale="en-GB" defaultValue="PT1H30M" />,
    )
    await userEvent.click(seg(container, 'hour'))
    await userEvent.keyboard('{Home}')
    expect(text(container, 'hour')).toBe('0')
  })
})

describe('focus', () => {
  it('moves between segments with left and right, and stops at the ends', async () => {
    const { container } = await render(
      <DurationInput label="Duration" locale="en-GB" units={['hour', 'minute', 'second']} />,
    )
    await userEvent.click(seg(container, 'hour'))
    await userEvent.keyboard('{ArrowRight}')
    expect(document.activeElement).toBe(seg(container, 'minute'))
    await userEvent.keyboard('{ArrowRight}{ArrowRight}')
    expect(document.activeElement).toBe(seg(container, 'second'))
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}{ArrowLeft}')
    expect(document.activeElement).toBe(seg(container, 'hour'))
  })

  it('fires onBlur only when focus leaves the whole field', async () => {
    const onBlur = vi.fn()
    const { container } = await render(
      <DurationInput label="Duration" locale="en-GB" onBlur={onBlur} />,
    )
    await userEvent.click(seg(container, 'hour'))
    await userEvent.keyboard('{ArrowRight}')
    expect(onBlur).not.toHaveBeenCalled()
    await userEvent.click(document.body)
    expect(onBlur).toHaveBeenCalledTimes(1)
  })

  it('gives every segment its own tab stop', async () => {
    const { container } = await render(<DurationInput label="Duration" locale="en-GB" />)
    for (const element of container.querySelectorAll('[data-rx-duration-segment]')) {
      expect(element.getAttribute('tabindex')).toBe('0')
    }
  })
})

describe('controlled', () => {
  it('starts empty for a controlled null', async () => {
    const { container } = await render(
      <DurationInput label="Duration" locale="en-GB" value={null} onChange={() => undefined} />,
    )
    expect(text(container, 'hour')).toBe('hh')
    expect(text(container, 'minute')).toBe('mm')
  })

  it('follows the parent', async () => {
    function Harness() {
      const [value, setValue] = useState<string | null>('PT1H0M')
      return (
        <>
          <DurationInput label="Duration" locale="en-GB" value={value} onChange={setValue} />
          <button
            type="button"
            onClick={() => {
              setValue('PT2H30M')
            }}
          >
            Set
          </button>
        </>
      )
    }
    const { container } = await render(<Harness />)
    await userEvent.click(page.getByRole('button', { name: 'Set' }))
    expect(text(container, 'hour')).toBe('2')
    expect(text(container, 'minute')).toBe('30')
  })

  it('empties when the parent writes null', async () => {
    function Harness() {
      const [value, setValue] = useState<string | null>('PT1H30M')
      return (
        <>
          <DurationInput label="Duration" locale="en-GB" value={value} onChange={setValue} />
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
    await userEvent.click(page.getByRole('button', { name: 'Clear' }))
    expect(text(container, 'hour')).toBe('hh')
  })

  /**
   * A half-typed number belongs to the keystrokes that produced it. Once the
   * parent writes a new value, the next digit must start a fresh number rather
   * than extending one the user can no longer see.
   */
  it('does not let a stale digit buffer extend a value that arrived from outside', async () => {
    function Harness() {
      const [value, setValue] = useState<string | null>('PT0S')
      return (
        <>
          <DurationInput label="Duration" locale="en-GB" value={value} onChange={setValue} />
          <button
            type="button"
            onClick={() => {
              setValue('PT2H0M')
            }}
          >
            Set
          </button>
        </>
      )
    }
    const { container } = await render(<Harness />)
    await userEvent.click(seg(container, 'minute'))
    await userEvent.keyboard('1')
    await userEvent.click(page.getByRole('button', { name: 'Set' }))
    await userEvent.click(seg(container, 'minute'))
    await userEvent.keyboard('5')
    expect(text(container, 'minute')).toBe('05')
  })
})

describe('range', () => {
  it('marks a duration outside the range invalid but still reports it', async () => {
    const onChange = vi.fn()
    const { container } = await render(
      <DurationInput
        label="Duration"
        locale="en-GB"
        min="PT15M"
        max="PT2H"
        onChange={onChange}
        onWarn={() => undefined}
      />,
    )
    await userEvent.click(seg(container, 'hour'))
    await userEvent.keyboard('05')
    await userEvent.keyboard('00')
    expect(onChange).toHaveBeenLastCalledWith('PT5H')
    expect(container.querySelector('[data-rx-duration-root]')?.hasAttribute('data-invalid')).toBe(
      true,
    )
  })

  it('withholds an out-of-range duration when asked to', async () => {
    const onChange = vi.fn()
    const { container } = await render(
      <DurationInput
        label="Duration"
        locale="en-GB"
        max="PT2H"
        emitOutOfRange={false}
        onChange={onChange}
        onWarn={() => undefined}
      />,
    )
    await userEvent.click(seg(container, 'hour'))
    await userEvent.keyboard('05')
    await userEvent.keyboard('00')
    expect(onChange).toHaveBeenLastCalledWith(null)
  })

  /**
   * `min="PT10M"` beside `max="PT2H"` is a perfectly ordinary range that sorts
   * backwards as a string. A lexical check would drop both bounds.
   */
  it('honours a range a string comparison would reject', async () => {
    const { container } = await render(
      <DurationInput
        label="Duration"
        locale="en-GB"
        min="PT10M"
        max="PT2H"
        defaultValue="PT30M"
        onWarn={() => undefined}
      />,
    )
    expect(container.querySelector('[data-rx-duration-root]')?.hasAttribute('data-invalid')).toBe(
      false,
    )
  })

  it('ignores a range nothing can satisfy', async () => {
    const { container } = await render(
      <DurationInput
        label="Duration"
        locale="en-GB"
        min="PT2H"
        max="PT15M"
        defaultValue="PT1H"
        onWarn={() => undefined}
      />,
    )
    expect(container.querySelector('[data-rx-duration-root]')?.hasAttribute('data-invalid')).toBe(
      false,
    )
  })
})

describe('states', () => {
  it('refuses every edit while disabled', async () => {
    const onChange = vi.fn()
    const { container } = await render(
      <DurationInput
        label="Duration"
        locale="en-GB"
        disabled
        defaultValue="PT1H30M"
        onChange={onChange}
      />,
    )
    // Focused directly rather than clicked: the segment is out of the tab order
    // and a click would be waiting for something that never becomes actionable.
    seg(container, 'minute').focus()
    await userEvent.keyboard('45')
    expect(text(container, 'minute')).toBe('30')
    expect(onChange).not.toHaveBeenCalled()
    expect(seg(container, 'minute').getAttribute('tabindex')).toBe('-1')
  })

  it('refuses every edit while read-only but stays focusable', async () => {
    const { container } = await render(
      <DurationInput label="Duration" locale="en-GB" readOnly defaultValue="PT1H30M" />,
    )
    await userEvent.click(seg(container, 'minute'))
    await userEvent.keyboard('{ArrowUp}')
    expect(text(container, 'minute')).toBe('30')
    // Typed digits and the carry on blur are refused too, not just the arrows.
    await userEvent.keyboard('45')
    expect(text(container, 'minute')).toBe('30')
    await userEvent.click(document.body)
    expect(text(container, 'minute')).toBe('30')
    expect(seg(container, 'minute').getAttribute('tabindex')).toBe('0')
    expect(seg(container, 'minute').getAttribute('aria-readonly')).toBe('true')
  })
})

describe('forms', () => {
  it('posts the ISO duration under the given name', async () => {
    let submitted: string | null = null
    const { container } = await render(
      <form
        onSubmit={(event) => {
          event.preventDefault()
          const entry = new FormData(event.currentTarget).get('lasts')
          submitted = typeof entry === 'string' ? entry : null
        }}
      >
        <DurationInput label="Duration" locale="en-GB" name="lasts" defaultValue="PT1H30M" />
        <button type="submit">Save</button>
      </form>,
    )
    expect(container.querySelector('[data-rx-duration-value]')).not.toBeNull()
    await userEvent.click(page.getByRole('button', { name: 'Save' }))
    expect(submitted).toBe('PT1H30M')
  })

  it('emits no hidden input at all without a name', async () => {
    const { container } = await render(<DurationInput label="Duration" locale="en-GB" />)
    expect(container.querySelector('[data-rx-duration-value]')).toBeNull()
  })

  it('posts an empty string while the duration is incomplete', async () => {
    const { container } = await render(
      <DurationInput label="Duration" locale="en-GB" name="lasts" />,
    )
    expect(container.querySelector<HTMLInputElement>('[data-rx-duration-value]')?.value).toBe('')
  })
})
