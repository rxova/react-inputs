import { describe, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { useState } from 'react'
import { MeasurementInput } from '../MeasurementInput'
import type { MeasurementUnit } from '../units'

/**
 * The pass written from the other side of the field: what does someone trying
 * to break this hand it?
 *
 * Every case here is a prop or a key sequence a real consumer can produce, and
 * the assertion is always the same shape — the field keeps working and keeps
 * telling the truth. The equivalent pass on the seat map found five real
 * defects and on the duration input two, so this is not decoration.
 */

/** Diagnostics are the subject elsewhere; here they would only be noise. */
const quiet = { onWarn: () => undefined }

function seg(container: HTMLElement, unit: MeasurementUnit) {
  return container.querySelector<HTMLElement>(`[data-rx-measurement-segment="${unit}"]`)!
}

function order(container: HTMLElement) {
  return Array.from(container.querySelectorAll('[data-rx-measurement-segment]')).map((element) =>
    element.getAttribute('data-rx-measurement-segment'),
  )
}

describe('hostile units', () => {
  it('renders a working field from an array of pure junk', async () => {
    const { container } = await render(
      <MeasurementInput
        label="H"
        locale="en-GB"
        units={['furlong', 'parsec', '', null, 7, {}] as unknown as MeasurementUnit[]}
        {...quiet}
      />,
    )
    expect(order(container)).toEqual(['meter', 'centimeter'])
    await userEvent.click(seg(container, 'centimeter'))
    await userEvent.keyboard('80')
    expect(seg(container, 'centimeter').textContent).toBe('80')
  })

  it('renders a working field from an array of nothing but duplicates', async () => {
    const { container } = await render(
      <MeasurementInput label="H" locale="en-GB" units={['inch', 'inch', 'inch']} {...quiet} />,
    )
    expect(order(container)).toEqual(['inch'])
  })

  it('keeps the field usable when every dimension is thrown at it at once', async () => {
    const { container } = await render(
      <MeasurementInput
        label="H"
        locale="en-GB"
        units={['meter', 'pound', 'celsius', 'byte', 'acre', 'centimeter']}
        {...quiet}
      />,
    )
    // The first unit's dimension wins; nothing from the others survives.
    expect(order(container)).toEqual(['meter', 'centimeter'])
  })

  /**
   * The repair that keeps a segment's overflow point on a unit boundary. Left
   * alone, an inches segment under metres would have a ceiling of 39.37 — a
   * fraction the segment cannot display and the carry cannot reach.
   */
  it('never renders a segment whose overflow rule cannot exist', async () => {
    for (const units of [
      ['meter', 'inch'],
      ['hectare', 'acre'],
      ['mile', 'kilometer'],
      ['kilometer', 'mile', 'yard'],
    ] as MeasurementUnit[][]) {
      const { container } = await render(
        <MeasurementInput label="H" locale="en-GB" units={units} {...quiet} />,
      )
      const shown = order(container) as MeasurementUnit[]
      for (let index = 1; index < shown.length; index++) {
        const max = seg(container, shown[index]!).getAttribute('aria-valuemax')
        expect(Number.isInteger(Number(max))).toBe(true)
      }
    }
  })

  it('survives a units array whose identity changes on every render', async () => {
    // A consumer writing `units={['foot', 'inch']}` inline hands a new array
    // every time. If that fed a state update the field would re-render forever.
    function Harness() {
      const [, force] = useState(0)
      return (
        <>
          <MeasurementInput label="H" locale="en-GB" units={['foot', 'inch']} {...quiet} />
          <button
            type="button"
            onClick={() => {
              force((count) => count + 1)
            }}
          >
            rerender
          </button>
        </>
      )
    }
    const { container } = await render(<Harness />)
    await userEvent.click(page.getByRole('button', { name: 'rerender' }))
    await userEvent.click(page.getByRole('button', { name: 'rerender' }))
    expect(order(container)).toEqual(['foot', 'inch'])
  })
})

describe('hostile values', () => {
  it('empties the field rather than guessing at a value it cannot read', async () => {
    for (const value of [
      '180',
      '180 cm',
      '90 minute',
      '50 percent',
      '70 kilogram',
      'five foot',
      '',
      '-5 centimeter',
      'NaN meter',
    ]) {
      const { container } = await render(
        <MeasurementInput
          label="H"
          locale="en-GB"
          units={['meter', 'centimeter']}
          defaultValue={value}
          {...quiet}
        />,
      )
      expect(seg(container, 'meter').textContent).toBe('--')
    }
  })

  it('takes a value that is not a string at all without throwing', async () => {
    // Whatever a loosely-typed form library hands over. `.trim()` on a number
    // would throw from inside render and take the page with it.
    for (const value of [180, {}, [], true] as unknown as string[]) {
      const { container } = await render(
        <MeasurementInput label="H" locale="en-GB" defaultValue={value} {...quiet} />,
      )
      expect(seg(container, 'meter').textContent).toBe('--')
    }
  })

  it('holds a measurement far larger than any segment was sized for', async () => {
    const { container } = await render(
      <MeasurementInput
        label="Distance"
        locale="en-GB"
        units={['kilometer']}
        defaultValue="999999 kilometer"
        {...quiet}
      />,
    )
    // The leading segment is unbounded on purpose, so a number wider than the
    // placeholder renders rather than being clipped or refused.
    expect(seg(container, 'kilometer').textContent).toBe('999999')
  })

  it('does not let a huge value turn into Infinity', async () => {
    const onChange = vi.fn()
    await render(
      <MeasurementInput
        label="D"
        locale="en-GB"
        units={['petabyte']}
        defaultValue="1e400 petabyte"
        onChange={onChange}
        {...quiet}
      />,
    )
    // `1e400` is not this grammar's shape at all, so it never reaches the
    // arithmetic — the field is simply empty.
    expect(onChange).not.toHaveBeenCalledWith(expect.stringContaining('Infinity'))
  })
})

describe('hostile precision and steps', () => {
  it('falls back to whole numbers for a precision that makes no sense', async () => {
    for (const precision of [-3, 7, 1.5, Number.NaN, Infinity] as number[]) {
      const { container } = await render(
        <MeasurementInput
          label="H"
          locale="en-GB"
          units={['centimeter']}
          precision={precision}
          {...quiet}
        />,
      )
      expect(seg(container, 'centimeter').textContent).toBe('---')
    }
  })

  it('falls back to a usable step rather than freezing the arrows', async () => {
    for (const step of [0, -1, Number.NaN, Infinity, 0.25] as number[]) {
      const { container } = await render(
        <MeasurementInput
          label="H"
          locale="en-GB"
          units={['centimeter']}
          step={step}
          defaultValue="10 centimeter"
          {...quiet}
        />,
      )
      await userEvent.click(seg(container, 'centimeter'))
      await userEvent.keyboard('{ArrowUp}')
      expect(seg(container, 'centimeter').textContent).toBe('11')
    }
  })

  it('refuses to let a decimal segment drift off its own grid', async () => {
    const { container } = await render(
      <MeasurementInput
        label="T"
        locale="en-GB"
        units={['celsius']}
        precision={1}
        defaultValue="36 celsius"
        {...quiet}
      />,
    )
    await userEvent.click(seg(container, 'celsius'))
    for (let press = 0; press < 12; press++) await userEvent.keyboard('{ArrowUp}')
    // Twelve tenths, arrived at one at a time. Without rounding at each step
    // this is 37.199999999999996.
    expect(seg(container, 'celsius').textContent).toBe('37.2')
  })
})

describe('hostile key sequences', () => {
  it('ignores a flood of decimal points', async () => {
    const { container } = await render(
      <MeasurementInput label="T" locale="en-GB" units={['celsius']} precision={1} {...quiet} />,
    )
    await userEvent.click(seg(container, 'celsius'))
    await userEvent.keyboard('3......6')
    expect(seg(container, 'celsius').textContent).toBe('3.6')
  })

  it('never grows the fraction past the precision', async () => {
    const { container } = await render(
      <MeasurementInput label="T" locale="en-GB" units={['celsius']} precision={1} {...quiet} />,
    )
    await userEvent.click(seg(container, 'celsius'))
    await userEvent.keyboard('36.6')
    expect(seg(container, 'celsius').textContent).toBe('36.6')
    // A further digit starts a new number rather than shifting into the
    // fraction — the same restart the duration field does when a segment is
    // full, and what makes retyping a correction work without a Backspace.
    await userEvent.keyboard('6')
    expect(seg(container, 'celsius').textContent).toBe('6')
  })

  it('lets a mistyped decimal be retyped straight over the top', async () => {
    const { container } = await render(
      <MeasurementInput label="T" locale="en-GB" units={['celsius']} precision={1} {...quiet} />,
    )
    await userEvent.click(seg(container, 'celsius'))
    await userEvent.keyboard('36.6')
    await userEvent.keyboard('37.2')
    expect(seg(container, 'celsius').textContent).toBe('37.2')
  })

  it('survives the sign key held down', async () => {
    const { container } = await render(
      <MeasurementInput label="T" locale="en-GB" units={['celsius']} {...quiet} />,
    )
    await userEvent.click(seg(container, 'celsius'))
    await userEvent.keyboard('5-----')
    // Five toggles from a positive five: still negative.
    expect(seg(container, 'celsius').textContent).toBe('-5')
  })

  it('does nothing on Backspace over an already empty segment', async () => {
    const onChange = vi.fn()
    const { container } = await render(
      <MeasurementInput
        label="H"
        locale="en-GB"
        units={['foot', 'inch']}
        onChange={onChange}
        {...quiet}
      />,
    )
    await userEvent.click(seg(container, 'inch'))
    await userEvent.keyboard('{Backspace}{Backspace}{Backspace}')
    expect(seg(container, 'inch').textContent).toBe('--')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('leaves modifier combinations to the browser', async () => {
    const { container } = await render(
      <MeasurementInput label="H" locale="en-GB" units={['foot', 'inch']} {...quiet} />,
    )
    await userEvent.click(seg(container, 'foot'))
    await userEvent.keyboard('{Control>}5{/Control}')
    expect(seg(container, 'foot').textContent).toBe('--')
  })
})

describe('hostile callbacks', () => {
  it('survives a renderSegment that throws', async () => {
    const { container } = await render(
      <MeasurementInput
        label="H"
        locale="en-GB"
        units={['foot', 'inch']}
        defaultValue="71 inch"
        renderSegment={() => {
          throw new Error('consumer bug')
        }}
        {...quiet}
      />,
    )
    // The built-in text, rather than a blank page.
    expect(seg(container, 'foot').textContent).toBe('5')
  })

  it('survives a renderSegment that returns nothing visible', async () => {
    for (const value of [undefined, null, ''] as const) {
      const { container } = await render(
        <MeasurementInput
          label="H"
          locale="en-GB"
          units={['foot', 'inch']}
          defaultValue="71 inch"
          renderSegment={() => value}
          {...quiet}
        />,
      )
      // An empty spinbutton is the quieter, worse failure: no visible value and
      // an `aria-valuetext` describing a number nobody can see.
      expect(seg(container, 'foot').textContent).toBe('5')
    }
  })

  it('keeps working when onPartsChange throws', async () => {
    const { container } = await render(
      <MeasurementInput
        label="H"
        locale="en-GB"
        units={['foot', 'inch']}
        onPartsChange={() => {
          throw new Error('consumer bug')
        }}
        {...quiet}
      />,
    )
    await userEvent.click(seg(container, 'inch'))
    await userEvent.keyboard('11')
    expect(seg(container, 'inch').textContent).toBe('11')
  })

  /**
   * The deliberate non-fix. `onChange` is the consumer's state setter; catching
   * its exception would leave the parent holding a value the field no longer
   * shows, with the error that explains it swallowed. The uncontrolled value is
   * committed before the callback runs, so the field itself stays correct.
   */
  it('does not swallow an onChange that throws, and still shows the new value', async () => {
    // The exception is *meant* to escape, so it reaches window.onerror. Caught
    // here only so the runner does not count the component's correct behaviour
    // as an unhandled failure.
    const escaped: string[] = []
    const trap = (event: ErrorEvent) => {
      escaped.push(event.message)
      event.preventDefault()
    }
    window.addEventListener('error', trap)
    try {
      const { container } = await render(
        <MeasurementInput
          label="H"
          locale="en-GB"
          units={['foot', 'inch']}
          onChange={() => {
            throw new Error('consumer bug')
          }}
          {...quiet}
        />,
      )
      await userEvent.click(seg(container, 'foot'))
      await userEvent.keyboard('0511')
      expect(seg(container, 'inch').textContent).toBe('11')
      expect(escaped.some((message) => message.includes('consumer bug'))).toBe(true)
    } finally {
      window.removeEventListener('error', trap)
    }
  })
})

describe('hostile timing', () => {
  it('does not lose the carry when blur and a controlled write race', async () => {
    function Harness() {
      const [value, setValue] = useState<string | null>(null)
      return (
        <>
          <MeasurementInput
            label="H"
            locale="en-GB"
            units={['foot', 'inch']}
            value={value}
            onChange={setValue}
            {...quiet}
          />
          <button type="button">elsewhere</button>
        </>
      )
    }
    const { container } = await render(<Harness />)
    await userEvent.click(seg(container, 'foot'))
    await userEvent.keyboard('0014')
    await userEvent.click(page.getByRole('button', { name: 'elsewhere' }))
    expect([seg(container, 'foot').textContent, seg(container, 'inch').textContent]).toEqual([
      '1',
      '02',
    ])
  })

  it('keeps a controlled field showing exactly what the parent last set', async () => {
    // A parent that rejects every change: the field must snap back rather than
    // drifting away from the value it was given.
    const { container } = await render(
      <MeasurementInput
        label="H"
        locale="en-GB"
        units={['foot', 'inch']}
        value="71 inch"
        onChange={() => undefined}
        {...quiet}
      />,
    )
    await userEvent.click(seg(container, 'inch'))
    await userEvent.keyboard('03')
    expect(seg(container, 'inch').textContent).toBe('03')
    // Nothing the parent accepted, so nothing outlives a re-mount.
    const again = await render(
      <MeasurementInput
        label="H"
        locale="en-GB"
        units={['foot', 'inch']}
        value="71 inch"
        onChange={() => undefined}
        {...quiet}
      />,
    )
    expect(seg(again.container, 'inch').textContent).toBe('11')
  })
})

/**
 * The second adversarial pass, written after the first shipped.
 *
 * Each of these reproduced a real defect before the fix beside it. They are
 * kept as the regression net for exactly that reason: three of the four were
 * invisible from the outside, and the fourth destroyed data on the most obvious
 * feature anyone would build with this component.
 */
describe('hostile shape changes', () => {
  /**
   * The worst one. Segments are keyed by unit, so `{ foot: 5, inch: 11 }` is
   * simply absent from a metres-and-centimetres field: toggling the unit system
   * used to blank the field and silently lose the user's height.
   */
  it('keeps the measurement when the unit system is toggled', async () => {
    function Harness() {
      const [imperial, setImperial] = useState(true)
      const [value, setValue] = useState<string | null>('71 inch')
      return (
        <>
          <MeasurementInput
            label="Height"
            locale="en-GB"
            units={imperial ? ['foot', 'inch'] : ['meter', 'centimeter']}
            value={value}
            onChange={setValue}
            {...quiet}
          />
          <button
            type="button"
            onClick={() => {
              setImperial((on) => !on)
            }}
          >
            toggle
          </button>
        </>
      )
    }
    const { container } = await render(<Harness />)
    expect([seg(container, 'foot').textContent, seg(container, 'inch').textContent]).toEqual([
      '5',
      '11',
    ])

    await userEvent.click(page.getByRole('button', { name: 'toggle' }))
    // 71 inches is 180.34 cm, which this field shows to the centimetre.
    expect([seg(container, 'meter').textContent, seg(container, 'centimeter').textContent]).toEqual(
      ['1', '80'],
    )

    await userEvent.click(page.getByRole('button', { name: 'toggle' }))
    expect(seg(container, 'foot').textContent).toBe('5')
  })

  it('keeps an uncontrolled measurement across the same toggle', async () => {
    function Harness() {
      const [metric, setMetric] = useState(false)
      return (
        <>
          <MeasurementInput
            label="Height"
            locale="en-GB"
            units={metric ? ['meter', 'centimeter'] : ['foot', 'inch']}
            defaultValue="71 inch"
            {...quiet}
          />
          <button
            type="button"
            onClick={() => {
              setMetric(true)
            }}
          >
            metric
          </button>
        </>
      )
    }
    const { container } = await render(<Harness />)
    await userEvent.click(page.getByRole('button', { name: 'metric' }))
    expect(seg(container, 'centimeter').textContent).toBe('80')
  })

  it('re-shapes a half-filled field without inventing the missing part', async () => {
    function Harness() {
      const [metric, setMetric] = useState(false)
      return (
        <>
          <MeasurementInput
            label="Height"
            locale="en-GB"
            units={metric ? ['meter', 'centimeter'] : ['foot', 'inch']}
            {...quiet}
          />
          <button
            type="button"
            onClick={() => {
              setMetric(true)
            }}
          >
            metric
          </button>
        </>
      )
    }
    const { container } = await render(<Harness />)
    await userEvent.click(seg(container, 'foot'))
    await userEvent.keyboard('05')
    // Feet filled, inches empty: there is no measurement to carry over, so the
    // field empties rather than guessing at the missing segment.
    await userEvent.click(page.getByRole('button', { name: 'metric' }))
    expect(seg(container, 'meter').textContent).toBe('--')
  })

  it('re-shapes when precision changes under a value', async () => {
    function Harness() {
      const [places, setPlaces] = useState(0)
      return (
        <>
          <MeasurementInput
            label="Fever"
            locale="en-GB"
            units={['celsius']}
            precision={places}
            defaultValue="37 celsius"
            {...quiet}
          />
          <button
            type="button"
            onClick={() => {
              setPlaces(1)
            }}
          >
            tenths
          </button>
        </>
      )
    }
    const { container } = await render(<Harness />)
    expect(seg(container, 'celsius').textContent).toBe('37')
    await userEvent.click(page.getByRole('button', { name: 'tenths' }))
    expect(seg(container, 'celsius').textContent).toBe('37.0')
  })

  it('does not reset the field when an inline units array is re-created', async () => {
    // `units={['foot', 'inch']}` written inline is a new array every render. The
    // re-shape has to key on the units' contents, or typing would be wiped
    // continuously by the component's own re-renders.
    function Harness() {
      const [, force] = useState(0)
      return (
        <>
          <MeasurementInput label="H" locale="en-GB" units={['foot', 'inch']} {...quiet} />
          <button
            type="button"
            onClick={() => {
              force((count) => count + 1)
            }}
          >
            rerender
          </button>
        </>
      )
    }
    const { container } = await render(<Harness />)
    await userEvent.click(seg(container, 'inch'))
    await userEvent.keyboard('11')
    await userEvent.click(page.getByRole('button', { name: 'rerender' }))
    await userEvent.click(page.getByRole('button', { name: 'rerender' }))
    expect(seg(container, 'inch').textContent).toBe('11')
  })

  it('empties rather than carrying nonsense when the units change dimension', async () => {
    // A length cannot be carried into a mass field. The conversion is refused,
    // so the field empties instead of inventing a number.
    function Harness() {
      const [mass, setMass] = useState(false)
      return (
        <>
          <MeasurementInput
            label="H"
            locale="en-GB"
            units={mass ? ['stone', 'pound'] : ['foot', 'inch']}
            defaultValue="71 inch"
            {...quiet}
          />
          <button
            type="button"
            onClick={() => {
              setMass(true)
            }}
          >
            weigh
          </button>
        </>
      )
    }
    const { container } = await render(<Harness />)
    await userEvent.click(page.getByRole('button', { name: 'weigh' }))
    expect(seg(container, 'stone').textContent).toBe('--')
    expect(seg(container, 'pound').textContent).toBe('--')
  })

  /**
   * Two restarts that look the same and are not, because what ends a number
   * differs: a whole-number segment is finished at its width, while one that
   * accepts decimals stays open until its fraction fills. So the sign survives
   * a restart in the second case and not in the first.
   */
  it('starts a fresh number when a full whole-number segment overflows', async () => {
    const { container } = await render(
      <MeasurementInput label="T" locale="en-GB" units={['celsius']} {...quiet} />,
    )
    await userEvent.click(seg(container, 'celsius'))
    await userEvent.keyboard('-123')
    expect(seg(container, 'celsius').textContent).toBe('-123')
    // Finished at the width, so the buffer is gone and the next digit is a new
    // number — sign included. The alternative traps the user: they could never
    // type a positive value after a negative one without clearing first.
    await userEvent.keyboard('4')
    expect(seg(container, 'celsius').textContent).toBe('4')
  })

  it('keeps the sign when a decimal segment overflows mid-number', async () => {
    const { container } = await render(
      <MeasurementInput label="T" locale="en-GB" units={['celsius']} precision={1} {...quiet} />,
    )
    await userEvent.click(seg(container, 'celsius'))
    // Still mid-number here — the fraction has not been started, let alone
    // filled — so the buffer is live and the sign the user set survives.
    await userEvent.keyboard('-1234')
    expect(seg(container, 'celsius').textContent).toBe('-4')
  })

  it('lets a controlled value win when it lands in the same render as new units', async () => {
    function Harness() {
      const [state, setState] = useState({ metric: false, value: '71 inch' })
      return (
        <>
          <MeasurementInput
            label="H"
            locale="en-GB"
            units={state.metric ? ['meter', 'centimeter'] : ['foot', 'inch']}
            value={state.value}
            onChange={() => undefined}
            {...quiet}
          />
          <button
            type="button"
            onClick={() => {
              setState({ metric: true, value: '150 centimeter' })
            }}
          >
            both
          </button>
        </>
      )
    }
    const { container } = await render(<Harness />)
    await userEvent.click(page.getByRole('button', { name: 'both' }))
    // The parent's new value, not a conversion of the old one.
    expect([seg(container, 'meter').textContent, seg(container, 'centimeter').textContent]).toEqual(
      ['1', '50'],
    )
  })
})
