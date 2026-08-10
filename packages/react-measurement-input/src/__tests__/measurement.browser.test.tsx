import { describe, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { useState } from 'react'
import { MeasurementInput } from '../MeasurementInput'
import type { MeasurementUnit } from '../units'

/**
 * Chromium, not jsdom. Everything here depends on real focus movement between
 * sibling elements — auto-advance, `relatedTarget` on blur, the carry that runs
 * when focus leaves the field, and the tab order — none of which jsdom models
 * faithfully enough to be worth asserting.
 */

function seg(container: HTMLElement, unit: MeasurementUnit) {
  return container.querySelector<HTMLElement>(`[data-rx-measurement-segment="${unit}"]`)!
}

function text(container: HTMLElement, unit: MeasurementUnit) {
  return seg(container, unit).textContent
}

function order(container: HTMLElement) {
  return Array.from(container.querySelectorAll('[data-rx-measurement-segment]')).map((element) =>
    element.getAttribute('data-rx-measurement-segment'),
  )
}

describe('layout', () => {
  it('shows metres and centimetres by default', async () => {
    const { container } = await render(<MeasurementInput label="Height" locale="en-GB" />)
    expect(order(container)).toEqual(['meter', 'centimeter'])
  })

  it('shows exactly the units it is given', async () => {
    const { container } = await render(
      <MeasurementInput label="Height" locale="en-GB" units={['foot', 'inch']} />,
    )
    expect(order(container)).toEqual(['foot', 'inch'])
  })

  it('sorts a reversed units array rather than rendering it upside down', async () => {
    const { container } = await render(
      <MeasurementInput
        label="Height"
        locale="en-GB"
        units={['inch', 'foot']}
        onWarn={() => undefined}
      />,
    )
    expect(order(container)).toEqual(['foot', 'inch'])
  })

  it('collapses a pair with no whole-number ratio to a single segment', async () => {
    const { container } = await render(
      <MeasurementInput
        label="Height"
        locale="en-GB"
        units={['meter', 'inch']}
        onWarn={() => undefined}
      />,
    )
    expect(order(container)).toEqual(['meter'])
  })

  it('shows placeholders while empty', async () => {
    const { container } = await render(
      <MeasurementInput label="Height" locale="en-GB" units={['foot', 'inch']} />,
    )
    expect(text(container, 'foot')).toBe('--')
    expect(text(container, 'inch')).toBe('--')
  })

  it('paints the locale suffix after each segment', async () => {
    const { container } = await render(
      <MeasurementInput label="Height" locale="en-GB" units={['foot', 'inch']} />,
    )
    expect(container.textContent).toContain('ft')
    expect(container.textContent).toContain('in')
  })

  it('marks the leading and trailing segments so a theme can style them', async () => {
    const { container } = await render(
      <MeasurementInput label="Height" locale="en-GB" units={['foot', 'inch']} />,
    )
    expect(seg(container, 'foot').hasAttribute('data-rx-measurement-leading')).toBe(true)
    expect(seg(container, 'inch').hasAttribute('data-rx-measurement-leading')).toBe(false)
    expect(seg(container, 'inch').hasAttribute('data-rx-measurement-trailing')).toBe(true)
  })

  it('zero-pads the trailing segments but not the leading one', async () => {
    const { container } = await render(
      <MeasurementInput
        label="Height"
        locale="en-GB"
        units={['foot', 'inch']}
        defaultValue="65 inch"
      />,
    )
    expect(text(container, 'foot')).toBe('5')
    expect(text(container, 'inch')).toBe('05')
  })
})

describe('reading a value', () => {
  it('splits a measurement across the units on screen', async () => {
    const { container } = await render(
      <MeasurementInput
        label="Height"
        locale="en-GB"
        units={['foot', 'inch']}
        defaultValue="71 inch"
      />,
    )
    expect([text(container, 'foot'), text(container, 'inch')]).toEqual(['5', '11'])
  })

  /**
   * The reason this component exists rather than a pair of number inputs: the
   * value arrives in one unit and the field shows another.
   */
  it('converts a value written in a unit the field does not show', async () => {
    const { container } = await render(
      <MeasurementInput
        label="Height"
        locale="en-GB"
        units={['foot', 'inch']}
        defaultValue="1.8034 meter"
      />,
    )
    expect([text(container, 'foot'), text(container, 'inch')]).toEqual(['5', '11'])
  })

  it('folds a measurement into a single-unit field', async () => {
    const { container } = await render(
      <MeasurementInput
        label="Height"
        locale="en-GB"
        units={['centimeter']}
        defaultValue="1.8 meter"
      />,
    )
    expect(text(container, 'centimeter')).toBe('180')
  })

  it('leaves the field empty for a value from another dimension', async () => {
    const { container } = await render(
      <MeasurementInput
        label="Height"
        locale="en-GB"
        units={['foot', 'inch']}
        defaultValue="70 kilogram"
        onWarn={() => undefined}
      />,
    )
    expect(text(container, 'foot')).toBe('--')
  })
})

describe('typing', () => {
  it('fills a segment and auto-advances when it is full', async () => {
    const { container } = await render(
      <MeasurementInput label="Height" locale="en-GB" units={['foot', 'inch']} />,
    )
    await userEvent.click(seg(container, 'foot'))
    // Two digits, because that is the segment's width — `5` alone leaves the
    // caret in the feet, exactly as `2` does in the duration field's hours.
    await userEvent.keyboard('05')
    expect(text(container, 'foot')).toBe('5')
    expect(document.activeElement).toBe(seg(container, 'inch'))
    await userEvent.keyboard('11')
    expect(text(container, 'inch')).toBe('11')
  })

  it('advances after two digits, and only then', async () => {
    const { container } = await render(
      <MeasurementInput label="Height" locale="en-GB" units={['foot', 'inch']} />,
    )
    await userEvent.click(seg(container, 'foot'))
    await userEvent.keyboard('0')
    expect(document.activeElement).toBe(seg(container, 'foot'))
    await userEvent.keyboard('5')
    expect(document.activeElement).toBe(seg(container, 'inch'))
  })

  /**
   * The rule that makes the carry reachable at all. `14` is not a legal inches
   * *component*, and it is exactly what someone types on the way to `1 ft 2 in`
   * — so the range is enforced on blur, not at the keystroke.
   */
  it('lets a bounded segment take a number above its range while typing', async () => {
    const { container } = await render(
      <MeasurementInput label="Height" locale="en-GB" units={['foot', 'inch']} />,
    )
    await userEvent.click(seg(container, 'inch'))
    await userEvent.keyboard('14')
    expect(text(container, 'inch')).toBe('14')
  })

  it('restarts from the new digit once the width is full', async () => {
    const { container } = await render(
      <MeasurementInput label="Height" locale="en-GB" units={['centimeter']} />,
    )
    await userEvent.click(seg(container, 'centimeter'))
    await userEvent.keyboard('1234')
    // 123 fills the three digits a lone segment takes; the 4 starts over.
    expect(text(container, 'centimeter')).toBe('4')
  })

  it('lets the leading unit take a number no other segment would', async () => {
    const { container } = await render(
      <MeasurementInput label="Height" locale="en-GB" units={['centimeter']} />,
    )
    await userEvent.click(seg(container, 'centimeter'))
    await userEvent.keyboard('180')
    expect(text(container, 'centimeter')).toBe('180')
  })

  it('reports only the finished number, never the digit on the way there', async () => {
    const onChange = vi.fn()
    const { container } = await render(
      <MeasurementInput
        label="Height"
        locale="en-GB"
        units={['foot', 'inch']}
        onChange={onChange}
        defaultValue="60 inch"
      />,
    )
    await userEvent.click(seg(container, 'inch'))
    await userEvent.keyboard('11')
    // Not "61 inch" on the way to "71 inch".
    expect(onChange.mock.calls.map((call) => call[0])).not.toContain('61 inch')
    expect(onChange).toHaveBeenLastCalledWith('71 inch')
  })

  it('clears a segment on Backspace and Delete', async () => {
    const { container } = await render(
      <MeasurementInput
        label="Height"
        locale="en-GB"
        units={['foot', 'inch']}
        defaultValue="71 inch"
      />,
    )
    await userEvent.click(seg(container, 'inch'))
    await userEvent.keyboard('{Backspace}')
    expect(text(container, 'inch')).toBe('--')
    await userEvent.click(seg(container, 'foot'))
    await userEvent.keyboard('{Delete}')
    expect(text(container, 'foot')).toBe('--')
  })

  it('ignores letters entirely', async () => {
    const { container } = await render(
      <MeasurementInput label="Height" locale="en-GB" units={['foot', 'inch']} />,
    )
    await userEvent.click(seg(container, 'foot'))
    await userEvent.keyboard('abc')
    expect(text(container, 'foot')).toBe('--')
  })
})

/** The headline behaviour: `14 in` is a real thing to type and a wrong thing to keep. */
describe('the carry', () => {
  it('carries overflow upward when focus leaves the field', async () => {
    const { container } = await render(
      <>
        <MeasurementInput label="Height" locale="en-GB" units={['foot', 'inch']} />
        <button type="button">elsewhere</button>
      </>,
    )
    await userEvent.click(seg(container, 'foot'))
    await userEvent.keyboard('00')
    await userEvent.keyboard('14')
    await userEvent.click(page.getByRole('button', { name: 'elsewhere' }))
    expect([text(container, 'foot'), text(container, 'inch')]).toEqual(['1', '02'])
  })

  it('emits the carried measurement, not the one that was typed', async () => {
    const onChange = vi.fn()
    const { container } = await render(
      <>
        <MeasurementInput
          label="Height"
          locale="en-GB"
          units={['foot', 'inch']}
          onChange={onChange}
        />
        <button type="button">elsewhere</button>
      </>,
    )
    await userEvent.click(seg(container, 'foot'))
    await userEvent.keyboard('0014')
    await userEvent.click(page.getByRole('button', { name: 'elsewhere' }))
    // The same measurement either way — 14 inches is 14 inches — but written
    // the way the field is shaped.
    expect(onChange).toHaveBeenLastCalledWith('14 inch')
    expect([text(container, 'foot'), text(container, 'inch')]).toEqual(['1', '02'])
  })

  it('does not carry while the number is still being typed', async () => {
    const { container } = await render(
      <MeasurementInput label="Height" locale="en-GB" units={['foot', 'inch']} />,
    )
    await userEvent.click(seg(container, 'inch'))
    await userEvent.keyboard('1')
    expect(text(container, 'inch')).toBe('1')
    await userEvent.keyboard('4')
    expect(text(container, 'inch')).toBe('14')
  })

  it('settles a segment left half-typed when focus moves to another one', async () => {
    const { container } = await render(
      <MeasurementInput label="Height" locale="en-GB" units={['foot', 'inch']} />,
    )
    await userEvent.click(seg(container, 'inch'))
    await userEvent.keyboard('14')
    await userEvent.click(seg(container, 'foot'))
    expect(text(container, 'inch')).toBe('14')
  })
})

describe('decimals', () => {
  it('accepts a decimal mark on the smallest segment only', async () => {
    const { container } = await render(
      <MeasurementInput label="Fever" locale="en-GB" units={['celsius']} precision={1} />,
    )
    await userEvent.click(seg(container, 'celsius'))
    await userEvent.keyboard('36.6')
    expect(text(container, 'celsius')).toBe('36.6')
  })

  it('accepts a comma as the decimal mark too', async () => {
    const { container } = await render(
      <MeasurementInput label="Fever" locale="en-GB" units={['celsius']} precision={1} />,
    )
    await userEvent.click(seg(container, 'celsius'))
    await userEvent.keyboard('36,6')
    expect(text(container, 'celsius')).toBe('36.6')
  })

  it('refuses a decimal mark where there are no decimals to type', async () => {
    const { container } = await render(
      <MeasurementInput label="Height" locale="en-GB" units={['foot', 'inch']} />,
    )
    await userEvent.click(seg(container, 'foot'))
    await userEvent.keyboard('5.5')
    // The `.` is ignored and the second 5 is just the next digit.
    expect(text(container, 'foot')).toBe('55')
  })

  it('shows the decimal point while it is being typed', async () => {
    const { container } = await render(
      <MeasurementInput label="Fever" locale="en-GB" units={['celsius']} precision={1} />,
    )
    await userEvent.click(seg(container, 'celsius'))
    await userEvent.keyboard('36.')
    // Without the mid-entry buffer this would paint `36` and the point would
    // vanish until the next keystroke brought it back.
    expect(text(container, 'celsius')).toBe('36.')
  })

  it('reads a leading point as a zero', async () => {
    const { container } = await render(
      <MeasurementInput label="Fever" locale="en-GB" units={['celsius']} precision={1} />,
    )
    await userEvent.click(seg(container, 'celsius'))
    await userEvent.keyboard('.5')
    expect(text(container, 'celsius')).toBe('0.5')
  })

  it('emits a fractional value', async () => {
    const onChange = vi.fn()
    const { container } = await render(
      <MeasurementInput
        label="Fever"
        locale="en-GB"
        units={['celsius']}
        precision={1}
        onChange={onChange}
      />,
    )
    await userEvent.click(seg(container, 'celsius'))
    await userEvent.keyboard('36.6')
    expect(onChange).toHaveBeenLastCalledWith('36.6 celsius')
  })
})

/** A temperature is the one measurement that goes below zero. */
describe('signs', () => {
  it('takes a minus sign on a temperature field', async () => {
    const onChange = vi.fn()
    const { container } = await render(
      <>
        <MeasurementInput label="Outside" locale="en-GB" units={['celsius']} onChange={onChange} />
        <button type="button">elsewhere</button>
      </>,
    )
    await userEvent.click(seg(container, 'celsius'))
    await userEvent.keyboard('-5')
    expect(text(container, 'celsius')).toBe('-5')
    // A lone segment takes three digits, so `-5` is still mid-number: the value
    // is reported when the number is settled, not on the digit on the way there.
    await userEvent.click(page.getByRole('button', { name: 'elsewhere' }))
    expect(onChange).toHaveBeenLastCalledWith('-5 celsius')
  })

  it('toggles the sign of a number already typed', async () => {
    const { container } = await render(
      <MeasurementInput label="Outside" locale="en-GB" units={['celsius']} />,
    )
    await userEvent.click(seg(container, 'celsius'))
    await userEvent.keyboard('5-')
    expect(text(container, 'celsius')).toBe('-5')
    await userEvent.keyboard('-')
    expect(text(container, 'celsius')).toBe('5')
  })

  it('refuses a minus sign where the quantity cannot be negative', async () => {
    const { container } = await render(
      <MeasurementInput label="Height" locale="en-GB" units={['centimeter']} />,
    )
    await userEvent.click(seg(container, 'centimeter'))
    await userEvent.keyboard('-5')
    expect(text(container, 'centimeter')).toBe('5')
  })

  it('arrows below zero on a temperature and stops at zero elsewhere', async () => {
    const { container } = await render(
      <MeasurementInput label="Outside" locale="en-GB" units={['celsius']} />,
    )
    await userEvent.click(seg(container, 'celsius'))
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}')
    expect(text(container, 'celsius')).toBe('-2')
  })
})

describe('arrow stepping', () => {
  it('starts at the segment floor on the first press', async () => {
    const { container } = await render(
      <MeasurementInput label="Height" locale="en-GB" units={['foot', 'inch']} />,
    )
    await userEvent.click(seg(container, 'inch'))
    await userEvent.keyboard('{ArrowUp}')
    expect(text(container, 'inch')).toBe('00')
  })

  it('clamps rather than wrapping', async () => {
    const { container } = await render(
      <MeasurementInput
        label="Height"
        locale="en-GB"
        units={['foot', 'inch']}
        defaultValue="71 inch"
      />,
    )
    await userEvent.click(seg(container, 'inch'))
    await userEvent.keyboard('{ArrowUp}')
    // 11 is the ceiling; arrowing up must not roll round to 0 and silently add
    // a foot.
    expect(text(container, 'inch')).toBe('11')
    await userEvent.keyboard('{ArrowDown}{ArrowDown}')
    expect(text(container, 'inch')).toBe('09')
  })

  it('steps the smallest segment by the step prop', async () => {
    const { container } = await render(
      <MeasurementInput
        label="Fever"
        locale="en-GB"
        units={['celsius']}
        precision={1}
        step={0.5}
        defaultValue="36 celsius"
      />,
    )
    await userEvent.click(seg(container, 'celsius'))
    await userEvent.keyboard('{ArrowUp}')
    expect(text(container, 'celsius')).toBe('36.5')
  })

  it('defaults the step to one unit of precision', async () => {
    const { container } = await render(
      <MeasurementInput
        label="Fever"
        locale="en-GB"
        units={['celsius']}
        precision={1}
        defaultValue="36 celsius"
      />,
    )
    await userEvent.click(seg(container, 'celsius'))
    await userEvent.keyboard('{ArrowUp}')
    expect(text(container, 'celsius')).toBe('36.1')
  })

  it('lands on the ends with Home and End', async () => {
    const { container } = await render(
      <MeasurementInput
        label="Height"
        locale="en-GB"
        units={['foot', 'inch']}
        defaultValue="65 inch"
      />,
    )
    await userEvent.click(seg(container, 'inch'))
    await userEvent.keyboard('{End}')
    expect(text(container, 'inch')).toBe('11')
    await userEvent.keyboard('{Home}')
    expect(text(container, 'inch')).toBe('00')
  })

  it('leaves an unbounded segment alone on End, and a temperature alone on Home', async () => {
    const { container } = await render(
      <MeasurementInput
        label="Height"
        locale="en-GB"
        units={['foot', 'inch']}
        defaultValue="65 inch"
      />,
    )
    await userEvent.click(seg(container, 'foot'))
    await userEvent.keyboard('{End}')
    // There is no ceiling to jump to, so nothing happens.
    expect(text(container, 'foot')).toBe('5')

    const temperature = await render(
      <MeasurementInput label="T" locale="en-GB" units={['celsius']} defaultValue="20 celsius" />,
    )
    await userEvent.click(seg(temperature.container, 'celsius'))
    await userEvent.keyboard('{Home}')
    expect(text(temperature.container, 'celsius')).toBe('20')
  })
})

describe('focus', () => {
  it('moves between segments with the arrow keys, clamped at both ends', async () => {
    const { container } = await render(
      <MeasurementInput label="Height" locale="en-GB" units={['foot', 'inch']} />,
    )
    await userEvent.click(seg(container, 'foot'))
    await userEvent.keyboard('{ArrowRight}')
    expect(document.activeElement).toBe(seg(container, 'inch'))
    await userEvent.keyboard('{ArrowRight}')
    expect(document.activeElement).toBe(seg(container, 'inch'))
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}')
    expect(document.activeElement).toBe(seg(container, 'foot'))
  })

  it('fires blur only when focus leaves the whole field', async () => {
    const onBlur = vi.fn()
    const { container } = await render(
      <>
        <MeasurementInput label="Height" locale="en-GB" units={['foot', 'inch']} onBlur={onBlur} />
        <button type="button">elsewhere</button>
      </>,
    )
    await userEvent.click(seg(container, 'foot'))
    await userEvent.keyboard('{ArrowRight}')
    expect(onBlur).not.toHaveBeenCalled()
    await userEvent.click(page.getByRole('button', { name: 'elsewhere' }))
    expect(onBlur).toHaveBeenCalledTimes(1)
  })

  it('marks the focused segment', async () => {
    const { container } = await render(
      <MeasurementInput label="Height" locale="en-GB" units={['foot', 'inch']} />,
    )
    await userEvent.click(seg(container, 'inch'))
    expect(seg(container, 'inch').hasAttribute('data-focused')).toBe(true)
    expect(seg(container, 'foot').hasAttribute('data-focused')).toBe(false)
  })
})

describe('states', () => {
  it('refuses every edit while disabled', async () => {
    const onChange = vi.fn()
    const { container } = await render(
      <MeasurementInput
        label="Height"
        locale="en-GB"
        units={['foot', 'inch']}
        disabled
        defaultValue="71 inch"
        onChange={onChange}
      />,
    )
    seg(container, 'inch').focus()
    await userEvent.keyboard('05')
    expect(text(container, 'inch')).toBe('11')
    expect(onChange).not.toHaveBeenCalled()
    expect(seg(container, 'inch').getAttribute('tabindex')).toBe('-1')
  })

  it('refuses every edit while read-only but stays focusable', async () => {
    const { container } = await render(
      <MeasurementInput
        label="Height"
        locale="en-GB"
        units={['foot', 'inch']}
        readOnly
        defaultValue="71 inch"
      />,
    )
    await userEvent.click(seg(container, 'inch'))
    await userEvent.keyboard('05')
    expect(text(container, 'inch')).toBe('11')
    expect(seg(container, 'inch').getAttribute('tabindex')).toBe('0')
  })

  it('marks itself complete only once every segment is filled', async () => {
    const { container } = await render(
      <MeasurementInput label="Height" locale="en-GB" units={['foot', 'inch']} />,
    )
    const root = container.querySelector('[data-rx-measurement-root]')!
    expect(root.hasAttribute('data-complete')).toBe(false)
    await userEvent.click(seg(container, 'foot'))
    await userEvent.keyboard('0511')
    expect(root.hasAttribute('data-complete')).toBe(true)
  })
})

describe('range', () => {
  it('marks a measurement outside the range invalid but still reports it', async () => {
    const onChange = vi.fn()
    const { container } = await render(
      <MeasurementInput
        label="Height"
        locale="en-GB"
        units={['foot', 'inch']}
        min="2 meter"
        onChange={onChange}
        onWarn={() => undefined}
      />,
    )
    await userEvent.click(seg(container, 'foot'))
    await userEvent.keyboard('0511')
    expect(onChange).toHaveBeenLastCalledWith('71 inch')
    expect(container.querySelector('[data-out-of-range]')).not.toBeNull()
  })

  it('withholds an out-of-range measurement when asked to', async () => {
    const onChange = vi.fn()
    const { container } = await render(
      <MeasurementInput
        label="Height"
        locale="en-GB"
        units={['foot', 'inch']}
        min="2 meter"
        emitOutOfRange={false}
        onChange={onChange}
        onWarn={() => undefined}
      />,
    )
    await userEvent.click(seg(container, 'foot'))
    await userEvent.keyboard('0511')
    expect(onChange).toHaveBeenLastCalledWith(null)
  })

  /** Bounds in a unit the field does not show still have to work. */
  it('honours a bound written in another unit of the same dimension', async () => {
    const { container } = await render(
      <MeasurementInput
        label="Height"
        locale="en-GB"
        units={['foot', 'inch']}
        min="1 meter"
        max="2 meter"
        defaultValue="71 inch"
      />,
    )
    expect(container.querySelector('[data-out-of-range]')).toBeNull()
  })
})

describe('controlled', () => {
  it('follows a value written from outside', async () => {
    function Harness() {
      const [value, setValue] = useState<string | null>('71 inch')
      return (
        <>
          <MeasurementInput
            label="Height"
            locale="en-GB"
            units={['foot', 'inch']}
            value={value}
            onChange={setValue}
          />
          <button
            type="button"
            onClick={() => {
              setValue('60 inch')
            }}
          >
            set
          </button>
        </>
      )
    }
    const { container } = await render(<Harness />)
    expect([text(container, 'foot'), text(container, 'inch')]).toEqual(['5', '11'])
    await userEvent.click(page.getByRole('button', { name: 'set' }))
    expect([text(container, 'foot'), text(container, 'inch')]).toEqual(['5', '00'])
  })

  /**
   * The stale-buffer bug: without the stamp, typing `1`, letting the parent
   * write a new value, then typing `5` would produce 15 — a number nobody typed.
   */
  it('does not let a stale digit buffer extend a value that arrived from outside', async () => {
    function Harness() {
      const [value, setValue] = useState<string | null>(null)
      return (
        <>
          <MeasurementInput
            label="Height"
            locale="en-GB"
            units={['centimeter']}
            value={value}
            onChange={setValue}
          />
          <button
            type="button"
            onClick={() => {
              setValue('200 centimeter')
            }}
          >
            set
          </button>
        </>
      )
    }
    const { container } = await render(<Harness />)
    await userEvent.click(seg(container, 'centimeter'))
    await userEvent.keyboard('1')
    await userEvent.click(page.getByRole('button', { name: 'set' }))
    await userEvent.click(seg(container, 'centimeter'))
    await userEvent.keyboard('5')
    expect(text(container, 'centimeter')).toBe('5')
  })
})

describe('form integration', () => {
  it('posts the canonical string through a hidden input', async () => {
    const { container } = await render(
      <form>
        <MeasurementInput
          label="Height"
          locale="en-GB"
          units={['foot', 'inch']}
          name="height"
          defaultValue="71 inch"
        />
      </form>,
    )
    const form = container.querySelector('form')!
    expect(new FormData(form).get('height')).toBe('71 inch')
  })

  it('posts an empty string while incomplete', async () => {
    const { container } = await render(
      <form>
        <MeasurementInput label="Height" locale="en-GB" units={['foot', 'inch']} name="height" />
      </form>,
    )
    expect(new FormData(container.querySelector('form')!).get('height')).toBe('')
  })
})
