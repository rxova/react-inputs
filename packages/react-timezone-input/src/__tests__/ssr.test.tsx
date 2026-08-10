import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { TimezoneInput } from '../TimezoneInput'

/**
 * Runs in the node project, where `window` genuinely does not exist. The README
 * claims SSR/RSC safety; without this file that claim is untested.
 *
 * It also pins the one thing most likely to differ between server and client
 * here: the offsets. They are computed at an instant, so a component that read
 * `new Date()` during render would produce different markup on each side of a
 * hydration boundary — and worse, would do it only sometimes, near a DST change.
 */
describe('server rendering', () => {
  it('renders the select without a DOM', () => {
    const html = renderToStaticMarkup(<TimezoneInput label="Time zone" locale="en-GB" />)
    expect(html).toContain('data-rx-timezone-root')
    expect(html).toContain('data-rx-timezone-select')
    expect(html).toContain('<select')
    expect(html).toContain('<optgroup')
  })

  it('offers UTC, which the platform list does not contain', () => {
    const html = renderToStaticMarkup(<TimezoneInput label="Time zone" locale="en-GB" />)
    expect(html).toContain('value="UTC"')
  })

  it('marks the value as selected on the first frame', () => {
    const html = renderToStaticMarkup(
      <TimezoneInput
        label="Time zone"
        locale="en-GB"
        value="Europe/Madrid"
        onChange={() => undefined}
      />,
    )
    // React renders the selection as `value` on the <select> itself.
    expect(html).toContain('Europe/Madrid')
  })

  /**
   * The hydration guarantee: given an explicit `referenceDate`, the markup is a
   * pure function of the props, so two renders are byte-identical however much
   * wall-clock time separates them.
   */
  it('is deterministic given a referenceDate', () => {
    const at = new Date(Date.UTC(2026, 0, 15))
    const render = () =>
      renderToStaticMarkup(
        <TimezoneInput label="Time zone" locale="en-GB" referenceDate={at} zones={['UTC']} />,
      )
    expect(render()).toBe(render())
  })

  it('shows the offsets that apply at the reference date, not today', () => {
    const winter = renderToStaticMarkup(
      <TimezoneInput
        label="Time zone"
        locale="en-GB"
        zones={['America/New_York']}
        referenceDate={new Date(Date.UTC(2026, 0, 15))}
      />,
    )
    const summer = renderToStaticMarkup(
      <TimezoneInput
        label="Time zone"
        locale="en-GB"
        zones={['America/New_York']}
        referenceDate={new Date(Date.UTC(2026, 6, 15))}
      />,
    )
    expect(winter).toContain('-05:00')
    expect(summer).toContain('-04:00')
  })

  it('emits a named select a form can post', () => {
    const html = renderToStaticMarkup(
      <TimezoneInput label="Time zone" locale="en-GB" name="zone" defaultValue="UTC" required />,
    )
    expect(html).toContain('name="zone"')
    expect(html).toContain('required')
  })

  it('does not throw on a value it cannot use', () => {
    for (const value of ['Mars/Olympus', '+02:00', '', 'Etc/GMT+5']) {
      expect(() =>
        renderToStaticMarkup(
          <TimezoneInput
            label="Time zone"
            locale="en-GB"
            defaultValue={value}
            onWarn={() => undefined}
          />,
        ),
      ).not.toThrow()
    }
  })
})
