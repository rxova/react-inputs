import { afterEach, describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { TimezoneInput } from '../TimezoneInput'

/**
 * The development diagnostics, from the outside.
 *
 * `warn.test.ts` covers what each inspector *says*; this covers when the hook
 * decides to say it, where it sends it, and that it says it once. The whole path
 * is dropped from production builds, so this is the only place the wiring is
 * exercised at all.
 */

afterEach(() => {
  vi.restoreAllMocks()
})

describe('routing', () => {
  it('sends a warning to onWarn when one is given', async () => {
    const onWarn = vi.fn()
    await render(
      <TimezoneInput label="Zone" locale="en-GB" defaultValue="Mars/Olympus" onWarn={onWarn} />,
    )
    expect(onWarn).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'value-unknown-zone', prop: 'defaultValue' }),
    )
  })

  it('falls back to console.warn when no onWarn is given', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    await render(<TimezoneInput label="Zone" locale="en-GB" defaultValue="Mars/Olympus" />)
    expect(warn).toHaveBeenCalled()
    expect(String(warn.mock.calls[0]?.[0])).toContain('[react-timezone-input]')
  })

  it('says each distinct thing once, not once per interaction', async () => {
    const onWarn = vi.fn()
    const { container } = await render(
      <TimezoneInput
        label="Zone"
        locale="en-GB"
        zones={['UTC', 'Europe/Madrid']}
        defaultValue="Mars/Olympus"
        onWarn={onWarn}
      />,
    )
    const before = onWarn.mock.calls.length
    const element = container.querySelector<HTMLSelectElement>('[data-rx-timezone-select]')!
    await userEvent.selectOptions(element, 'Europe/Madrid')
    await userEvent.selectOptions(element, 'UTC')
    expect(onWarn.mock.calls.length).toBe(before)
  })

  it('survives an onWarn that throws', async () => {
    const onWarn = vi.fn(() => {
      throw new Error('boom')
    })
    const { container } = await render(
      <TimezoneInput label="Zone" locale="en-GB" defaultValue="Mars/Olympus" onWarn={onWarn} />,
    )
    expect(onWarn).toHaveBeenCalled()
    expect(container.querySelector('[data-rx-timezone-root]')).not.toBeNull()
  })
})

describe('what gets reported', () => {
  it('reports an offset masquerading as a zone', async () => {
    const onWarn = vi.fn()
    await render(<TimezoneInput label="Zone" locale="en-GB" value="+02:00" onWarn={onWarn} />)
    expect(onWarn.mock.calls.map((call) => call[0].code)).toContain('value-offset-not-zone')
  })

  it('reports the Etc/GMT sign inversion', async () => {
    const onWarn = vi.fn()
    await render(<TimezoneInput label="Zone" locale="en-GB" value="Etc/GMT+5" onWarn={onWarn} />)
    expect(onWarn.mock.calls.map((call) => call[0].code)).toContain('value-etc-inverted')
  })

  it('reports a zone list it had to repair', async () => {
    const onWarn = vi.fn()
    await render(
      <TimezoneInput
        label="Zone"
        locale="en-GB"
        zones={['Europe/Madrid', 'Mars/Olympus']}
        onWarn={onWarn}
      />,
    )
    expect(onWarn.mock.calls.map((call) => call[0].code)).toContain('zones-invalid')

    const empty = vi.fn()
    await render(<TimezoneInput label="Zone" locale="en-GB" zones={[]} onWarn={empty} />)
    expect(empty.mock.calls.map((call) => call[0].code)).toContain('zones-empty')
  })

  it('reports a referenceDate that is not a date', async () => {
    const onWarn = vi.fn()
    await render(
      <TimezoneInput
        label="Zone"
        locale="en-GB"
        referenceDate={new Date('2026-13-01')}
        onWarn={onWarn}
      />,
    )
    expect(onWarn.mock.calls.map((call) => call[0].code)).toContain('reference-date-invalid')
  })

  it('reports a locale Intl refused, and says nothing when none is given', async () => {
    const bad = vi.fn()
    await render(<TimezoneInput label="Zone" locale="en_US" onWarn={bad} />)
    expect(bad.mock.calls.map((call) => call[0].code)).toContain('locale-invalid')

    const none = vi.fn()
    await render(<TimezoneInput label="Zone" onWarn={none} />)
    expect(none.mock.calls.map((call) => call[0].code)).not.toContain('locale-invalid')
  })

  it('stays quiet about a field that is configured correctly', async () => {
    const onWarn = vi.fn()
    await render(
      <TimezoneInput
        label="Zone"
        locale="en-GB"
        zones={['UTC', 'Europe/Madrid']}
        referenceDate={new Date(Date.UTC(2026, 0, 15))}
        defaultValue="Europe/Madrid"
        onWarn={onWarn}
      />,
    )
    expect(onWarn).not.toHaveBeenCalled()
  })
})
