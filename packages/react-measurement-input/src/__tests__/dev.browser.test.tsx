import { afterEach, describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { MeasurementInput } from '../MeasurementInput'

/**
 * The development diagnostics, from the outside.
 *
 * `warn.test.ts` covers what each inspector *says*; this covers when the hook
 * decides to say it, where it sends it, and that it says it once rather than
 * once per keystroke. The whole path is dropped from production builds, so this
 * is the only place the wiring is exercised at all.
 */

afterEach(() => {
  vi.restoreAllMocks()
})

describe('routing', () => {
  it('sends a warning to onWarn when one is given', async () => {
    const onWarn = vi.fn()
    await render(
      <MeasurementInput label="H" locale="en-GB" defaultValue="90 minute" onWarn={onWarn} />,
    )
    expect(onWarn).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'value-time-unit', prop: 'defaultValue' }),
    )
  })

  it('falls back to console.warn when no onWarn is given', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    await render(<MeasurementInput label="H" locale="en-GB" defaultValue="90 minute" />)
    expect(warn).toHaveBeenCalled()
    expect(String(warn.mock.calls[0]?.[0])).toContain('[react-measurement-input]')
  })

  it('says each distinct thing once, not once per keystroke', async () => {
    const onWarn = vi.fn()
    const { container } = await render(
      <MeasurementInput
        label="H"
        locale="en-GB"
        units={['foot', 'inch']}
        defaultValue="90 minute"
        onWarn={onWarn}
      />,
    )
    const before = onWarn.mock.calls.length
    const inch = container.querySelector<HTMLElement>('[data-rx-measurement-segment="inch"]')!
    await userEvent.click(inch)
    await userEvent.keyboard('05')
    expect(onWarn.mock.calls.length).toBe(before)
  })

  it('survives an onWarn that throws', async () => {
    // A diagnostic that takes the field down with it is worse than no
    // diagnostic. The state is already set by the time this runs.
    const onWarn = vi.fn(() => {
      throw new Error('boom')
    })
    const { container } = await render(
      <MeasurementInput label="H" locale="en-GB" value="nope" onWarn={onWarn} />,
    )
    expect(onWarn).toHaveBeenCalled()
    expect(container.querySelector('[data-rx-measurement-root]')).not.toBeNull()
  })
})

describe('what gets reported', () => {
  it('reports a bare number as the ambiguity the field removes', async () => {
    const onWarn = vi.fn()
    await render(<MeasurementInput label="H" locale="en-GB" value="180" onWarn={onWarn} />)
    expect(onWarn.mock.calls.map((call) => call[0].code)).toContain('value-unparseable')
  })

  it('reports a value from another dimension', async () => {
    const onWarn = vi.fn()
    await render(
      <MeasurementInput
        label="H"
        locale="en-GB"
        units={['foot', 'inch']}
        value="70 kilogram"
        onWarn={onWarn}
      />,
    )
    expect(onWarn.mock.calls.map((call) => call[0].code)).toContain('value-dimension-mismatch')
  })

  it('reports a value finer than the field can show', async () => {
    const onWarn = vi.fn()
    await render(
      <MeasurementInput
        label="H"
        locale="en-GB"
        units={['foot', 'inch']}
        defaultValue="1.81 meter"
        onWarn={onWarn}
      />,
    )
    expect(onWarn.mock.calls.map((call) => call[0].code)).toContain('value-truncated')
  })

  it('reports both bounds and the impossible range between them', async () => {
    const onWarn = vi.fn()
    await render(
      <MeasurementInput label="H" locale="en-GB" min="2 meter" max="1 meter" onWarn={onWarn} />,
    )
    expect(onWarn.mock.calls.map((call) => call[0].code)).toContain('min-after-max')

    const bad = vi.fn()
    await render(<MeasurementInput label="H" locale="en-GB" min="nope" max="also" onWarn={bad} />)
    const codes = bad.mock.calls.map((call) => call[0].code)
    expect(codes).toContain('min-unparseable')
    expect(codes).toContain('max-unparseable')
  })

  it('reports each kind of repaired units array with its own code', async () => {
    const cases = [
      { units: ['inch', 'foot'], code: 'units-invalid' },
      { units: ['hour', 'minute'], code: 'units-not-convertible' },
      { units: ['meter', 'pound'], code: 'units-dimension-mixed' },
      { units: ['meter', 'inch'], code: 'units-ratio-not-integer' },
      { units: ['celsius', 'fahrenheit'], code: 'units-temperature-multi' },
    ] as const
    for (const { units, code } of cases) {
      const onWarn = vi.fn()
      await render(
        <MeasurementInput label="H" locale="en-GB" units={[...units] as never} onWarn={onWarn} />,
      )
      expect(onWarn.mock.calls.map((call) => call[0].code)).toContain(code)
    }
  })

  it('reports a precision and a step the field cannot honour', async () => {
    const onWarn = vi.fn()
    await render(
      <MeasurementInput label="H" locale="en-GB" precision={-3} step={0.25} onWarn={onWarn} />,
    )
    const codes = onWarn.mock.calls.map((call) => call[0].code)
    expect(codes).toContain('precision-invalid')
    expect(codes).toContain('step-invalid')
  })

  it('reports a locale Intl refused, and says nothing when none is given', async () => {
    const bad = vi.fn()
    await render(<MeasurementInput label="H" locale="en_US" onWarn={bad} />)
    expect(bad.mock.calls.map((call) => call[0].code)).toContain('locale-invalid')

    // No `locale` prop at all: the runtime's own locale, nothing to inspect.
    const none = vi.fn()
    await render(<MeasurementInput label="H" onWarn={none} />)
    expect(none.mock.calls.map((call) => call[0].code)).not.toContain('locale-invalid')
  })

  it('reports a completed value that falls outside the range', async () => {
    const onWarn = vi.fn()
    await render(
      <MeasurementInput
        label="H"
        locale="en-GB"
        units={['foot', 'inch']}
        min="2 meter"
        defaultValue="71 inch"
        onWarn={onWarn}
      />,
    )
    expect(onWarn.mock.calls.map((call) => call[0].code)).toContain('value-out-of-range')
  })

  it('stays quiet about a field that is configured correctly', async () => {
    const onWarn = vi.fn()
    await render(
      <MeasurementInput
        label="H"
        locale="en-GB"
        units={['foot', 'inch']}
        min="1 meter"
        max="2.2 meter"
        precision={0}
        step={1}
        defaultValue="71 inch"
        onWarn={onWarn}
      />,
    )
    expect(onWarn).not.toHaveBeenCalled()
  })
})
