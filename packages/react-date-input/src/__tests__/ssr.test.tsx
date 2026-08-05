import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { DateInput } from '../DateInput'

/**
 * Runs in the node project, where `window` genuinely does not exist. The
 * README claims SSR/RSC safety; without this file that claim is untested.
 *
 * It also pins the one thing that could differ between server and client:
 * segment order comes from `Intl`, which Node and the browser both ship but
 * from different ICU builds. An explicit `locale` makes the two agree, and
 * these assertions are what would catch it if they stopped agreeing.
 */
describe('server rendering', () => {
  it('renders the segments without a DOM', () => {
    const html = renderToStaticMarkup(<DateInput label="Date" locale="en-GB" />)
    expect(html).toContain('data-rx-date-root')
    expect(html).toContain('role="group"')
    expect(html).toContain('data-rx-date-segment="day"')
    expect(html).toContain('data-rx-date-segment="month"')
    expect(html).toContain('data-rx-date-segment="year"')
  })

  it('emits the locale order server-side, so hydration has nothing to correct', () => {
    const us = renderToStaticMarkup(<DateInput label="Date" locale="en-US" />)
    expect(us.indexOf('data-rx-date-segment="month"')).toBeLessThan(
      us.indexOf('data-rx-date-segment="day"'),
    )
    const gb = renderToStaticMarkup(<DateInput label="Date" locale="en-GB" />)
    expect(gb.indexOf('data-rx-date-segment="day"')).toBeLessThan(
      gb.indexOf('data-rx-date-segment="month"'),
    )
  })

  it('paints a value on the first frame', () => {
    const html = renderToStaticMarkup(
      <DateInput label="Date" locale="en-GB" value="2026-03-15" onChange={() => undefined} />,
    )
    expect(html).toContain('aria-valuenow="15"')
    expect(html).toContain('aria-valuetext="March"')
  })

  it('shows placeholders and no value when empty', () => {
    const html = renderToStaticMarkup(<DateInput label="Date" locale="en-GB" />)
    expect(html).toContain('data-placeholder')
    expect(html).toContain('aria-valuetext="dd"')
    expect(html).not.toContain('aria-valuenow')
  })

  it('emits the hidden field a native form posts', () => {
    const html = renderToStaticMarkup(
      <DateInput label="Date" locale="en-GB" name="due" defaultValue="2026-03-15" />,
    )
    expect(html).toContain('name="due"')
    expect(html).toContain('value="2026-03-15"')
    expect(html).toContain('type="hidden"')
  })

  it('omits the hidden field without a name', () => {
    const html = renderToStaticMarkup(<DateInput label="Date" locale="en-GB" />)
    expect(html).not.toContain('data-rx-date-value')
  })

  it('marks an out-of-range value on the server too', () => {
    const html = renderToStaticMarkup(
      <DateInput
        label="Date"
        locale="en-GB"
        min="2026-01-01"
        defaultValue="1999-03-15"
        onWarn={() => undefined}
      />,
    )
    expect(html).toContain('data-out-of-range')
  })
})
