import { afterEach, describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { DurationInput } from '../DurationInput'

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
    await render(<DurationInput label="D" locale="en-GB" defaultValue="P1M" onWarn={onWarn} />)
    expect(onWarn).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'value-calendar-unit', prop: 'defaultValue' }),
    )
  })

  it('falls back to console.warn when no onWarn is given', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    await render(<DurationInput label="D" locale="en-GB" defaultValue="P1M" />)
    expect(warn).toHaveBeenCalled()
    expect(String(warn.mock.calls[0]?.[0])).toContain('[react-duration-input]')
  })

  it('says each distinct thing once, not once per keystroke', async () => {
    const onWarn = vi.fn()
    const { container } = await render(
      <DurationInput label="D" locale="en-GB" defaultValue="P1M" onWarn={onWarn} />,
    )
    const before = onWarn.mock.calls.length
    const minute = container.querySelector<HTMLElement>('[data-rx-duration-segment="minute"]')!
    await userEvent.click(minute)
    await userEvent.keyboard('45')
    expect(onWarn.mock.calls.length).toBe(before)
  })
})

describe('what gets reported', () => {
  it('reports a value that is not a duration', async () => {
    const onWarn = vi.fn()
    await render(<DurationInput label="D" locale="en-GB" value="90" onWarn={onWarn} />)
    expect(onWarn.mock.calls.map((call) => call[0].code)).toContain('value-unparseable')
  })

  it('reports both bounds and the impossible range between them', async () => {
    const onWarn = vi.fn()
    await render(<DurationInput label="D" locale="en-GB" min="PT2H" max="PT1M" onWarn={onWarn} />)
    expect(onWarn.mock.calls.map((call) => call[0].code)).toContain('min-after-max')

    const bad = vi.fn()
    await render(<DurationInput label="D" locale="en-GB" min="nope" max="also" onWarn={bad} />)
    const codes = bad.mock.calls.map((call) => call[0].code)
    expect(codes).toContain('min-unparseable')
    expect(codes).toContain('max-unparseable')
  })

  it('reports a repaired units array', async () => {
    const onWarn = vi.fn()
    await render(
      <DurationInput label="D" locale="en-GB" units={['minute', 'hour']} onWarn={onWarn} />,
    )
    expect(onWarn.mock.calls.map((call) => call[0].code)).toContain('units-invalid')
  })

  it('reports a bad step only for a unit the field actually shows', async () => {
    const shown = vi.fn()
    await render(
      <DurationInput
        label="D"
        locale="en-GB"
        units={['minute', 'second']}
        secondStep={7}
        onWarn={shown}
      />,
    )
    expect(shown.mock.calls.map((call) => call[0].prop)).toContain('secondStep')

    // No seconds segment, so `secondStep` is not a mistake worth reporting.
    const hidden = vi.fn()
    await render(
      <DurationInput
        label="D"
        locale="en-GB"
        units={['hour', 'minute']}
        secondStep={7}
        onWarn={hidden}
      />,
    )
    expect(hidden.mock.calls.map((call) => call[0].prop)).not.toContain('secondStep')
  })

  it('reports a locale Intl refused, and says nothing when none is given', async () => {
    const bad = vi.fn()
    await render(<DurationInput label="D" locale="en_US" onWarn={bad} />)
    expect(bad.mock.calls.map((call) => call[0].code)).toContain('locale-invalid')

    // No `locale` prop at all: the runtime's own locale, nothing to inspect.
    const none = vi.fn()
    await render(<DurationInput label="D" onWarn={none} />)
    expect(none.mock.calls.map((call) => call[0].code)).not.toContain('locale-invalid')
  })

  it('reports a completed value that falls outside the range', async () => {
    const onWarn = vi.fn()
    await render(
      <DurationInput label="D" locale="en-GB" min="PT2H" defaultValue="PT30M" onWarn={onWarn} />,
    )
    expect(onWarn.mock.calls.map((call) => call[0].code)).toContain('value-out-of-range')
  })

  it('stays quiet about a field that is configured correctly', async () => {
    const onWarn = vi.fn()
    await render(
      <DurationInput
        label="D"
        locale="en-GB"
        units={['hour', 'minute']}
        min="PT15M"
        max="PT8H"
        minuteStep={15}
        defaultValue="PT1H30M"
        onWarn={onWarn}
      />,
    )
    expect(onWarn).not.toHaveBeenCalled()
  })
})
