import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { DurationInput } from '../DurationInput'

/**
 * Runs in the node project, where `window` genuinely does not exist. The README
 * claims SSR/RSC safety; without this file that claim is untested. It also pins
 * the one thing that could differ between server and client: the unit suffixes
 * come from `Intl`, which Node and the browser both ship but from different ICU
 * builds. An explicit `locale` makes the two agree.
 */
describe('server rendering', () => {
  it('renders the segments without a DOM', () => {
    const html = renderToStaticMarkup(<DurationInput label="Duration" locale="en-GB" />)
    expect(html).toContain('data-rx-duration-root')
    expect(html).toContain('role="group"')
    expect(html).toContain('data-rx-duration-segment="hour"')
    expect(html).toContain('data-rx-duration-segment="minute"')
  })

  it('emits exactly the units it was given, so hydration has nothing to correct', () => {
    const html = renderToStaticMarkup(
      <DurationInput label="D" locale="en-GB" units={['day', 'hour']} />,
    )
    expect(html).toContain('data-rx-duration-segment="day"')
    expect(html).not.toContain('data-rx-duration-segment="minute"')
  })

  it('paints the locale suffix server-side', () => {
    expect(renderToStaticMarkup(<DurationInput label="D" locale="de-DE" />)).toContain('Min.')
  })

  it('paints a value on the first frame', () => {
    const html = renderToStaticMarkup(
      <DurationInput label="D" locale="en-GB" value="PT2H30M" onChange={() => undefined} />,
    )
    expect(html).toContain('aria-valuenow="2"')
    expect(html).toContain('aria-valuetext="2 hours"')
  })

  it('shows placeholders and no value when empty', () => {
    const html = renderToStaticMarkup(<DurationInput label="D" locale="en-GB" />)
    expect(html).toContain('data-placeholder')
    expect(html).toContain('aria-valuetext="hh"')
    expect(html).not.toContain('aria-valuenow')
  })

  it('omits aria-valuemax on the leading segment, server-side too', () => {
    const html = renderToStaticMarkup(
      <DurationInput label="D" locale="en-GB" units={['hour', 'minute']} />,
    )
    // Only the minute segment has a ceiling to promise.
    expect(html.match(/aria-valuemax/g)).toHaveLength(1)
  })

  it('emits the hidden ISO field a native form posts', () => {
    const html = renderToStaticMarkup(
      <DurationInput label="D" locale="en-GB" name="lasts" defaultValue="PT1H30M" />,
    )
    expect(html).toContain('name="lasts"')
    expect(html).toContain('value="PT1H30M"')
    expect(html).toContain('type="hidden"')
  })

  it('omits the hidden field without a name', () => {
    expect(renderToStaticMarkup(<DurationInput label="D" locale="en-GB" />)).not.toContain(
      'data-rx-duration-value',
    )
  })

  it('marks an out-of-range value on the server too', () => {
    const html = renderToStaticMarkup(
      <DurationInput
        label="D"
        locale="en-GB"
        min="PT2H"
        defaultValue="PT30M"
        onWarn={() => undefined}
      />,
    )
    expect(html).toContain('data-out-of-range')
  })

  it('does not throw on a value it cannot read', () => {
    expect(() =>
      renderToStaticMarkup(
        <DurationInput label="D" locale="en-GB" defaultValue="P1M" onWarn={() => undefined} />,
      ),
    ).not.toThrow()
  })
})
