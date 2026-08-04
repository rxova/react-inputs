import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { TimeInput } from '../TimeInput'

/**
 * Runs in the node project, where `window` genuinely does not exist. The README
 * claims SSR/RSC safety; without this file that claim is untested. It also pins
 * the one thing that could differ between server and client: the layout comes
 * from `Intl`, which Node and the browser both ship but from different ICU
 * builds. An explicit `locale` makes the two agree.
 */
describe('server rendering', () => {
  it('renders the segments without a DOM', () => {
    const html = renderToStaticMarkup(<TimeInput label="Time" locale="en-GB" />)
    expect(html).toContain('data-rti-root')
    expect(html).toContain('role="group"')
    expect(html).toContain('data-rti-segment="hour"')
    expect(html).toContain('data-rti-segment="minute"')
  })

  it('emits the locale clock server-side, so hydration has nothing to correct', () => {
    expect(renderToStaticMarkup(<TimeInput label="T" locale="en-US" />)).toContain(
      'data-rti-segment="dayPeriod"',
    )
    expect(renderToStaticMarkup(<TimeInput label="T" locale="en-GB" />)).not.toContain(
      'data-rti-segment="dayPeriod"',
    )
  })

  it('paints a value on the first frame, on the right clock', () => {
    const html = renderToStaticMarkup(
      <TimeInput label="T" locale="en-US" value="14:30" onChange={() => undefined} />,
    )
    expect(html).toContain('aria-valuenow="2"')
    expect(html).toContain('aria-valuetext="PM"')
  })

  it('shows placeholders and no value when empty', () => {
    const html = renderToStaticMarkup(<TimeInput label="T" locale="en-GB" />)
    expect(html).toContain('data-placeholder')
    expect(html).toContain('aria-valuetext="hh"')
    expect(html).not.toContain('aria-valuenow')
  })

  it('emits the hidden 24-hour field a native form posts', () => {
    const html = renderToStaticMarkup(
      <TimeInput label="T" locale="en-US" name="at" defaultValue="14:30" />,
    )
    expect(html).toContain('name="at"')
    expect(html).toContain('value="14:30"')
    expect(html).toContain('type="hidden"')
  })

  it('omits the hidden field without a name', () => {
    expect(renderToStaticMarkup(<TimeInput label="T" locale="en-GB" />)).not.toContain(
      'data-rti-value',
    )
  })

  it('marks an out-of-range value on the server too', () => {
    const html = renderToStaticMarkup(
      <TimeInput
        label="T"
        locale="en-GB"
        min="09:00"
        defaultValue="07:30"
        onWarn={() => undefined}
      />,
    )
    expect(html).toContain('data-out-of-range')
  })
})
