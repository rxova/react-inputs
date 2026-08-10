import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MeasurementInput } from '../MeasurementInput'

/**
 * Runs in the node project, where `window` genuinely does not exist. The README
 * claims SSR/RSC safety; without this file that claim is untested. It also pins
 * the one thing that could differ between server and client: the unit suffixes
 * come from `Intl`, which Node and the browser both ship but from different ICU
 * builds. An explicit `locale` makes the two agree.
 */
describe('server rendering', () => {
  it('renders the segments without a DOM', () => {
    const html = renderToStaticMarkup(<MeasurementInput label="Height" locale="en-GB" />)
    expect(html).toContain('data-rx-measurement-root')
    expect(html).toContain('role="group"')
    expect(html).toContain('data-rx-measurement-segment="meter"')
    expect(html).toContain('data-rx-measurement-segment="centimeter"')
  })

  it('emits exactly the units it was given, so hydration has nothing to correct', () => {
    const html = renderToStaticMarkup(
      <MeasurementInput label="Height" locale="en-GB" units={['foot', 'inch']} />,
    )
    expect(html).toContain('data-rx-measurement-segment="foot"')
    expect(html).not.toContain('data-rx-measurement-segment="meter"')
  })

  it('records the dimension so a theme can style a temperature differently', () => {
    expect(
      renderToStaticMarkup(
        <MeasurementInput label="Fever" locale="en-GB" units={['celsius']} precision={1} />,
      ),
    ).toContain('data-rx-measurement-dimension="temperature"')
  })

  it('paints the locale suffix server-side', () => {
    const html = renderToStaticMarkup(
      <MeasurementInput label="Height" locale="en-GB" units={['foot', 'inch']} />,
    )
    expect(html).toContain('ft')
    expect(html).toContain('in')
  })

  it('paints a value on the first frame', () => {
    const html = renderToStaticMarkup(
      <MeasurementInput
        label="Height"
        locale="en-GB"
        units={['foot', 'inch']}
        value="71 inch"
        onChange={() => undefined}
      />,
    )
    expect(html).toContain('aria-valuenow="5"')
    expect(html).toContain('aria-valuetext="5 feet"')
    expect(html).toContain('aria-valuenow="11"')
  })

  it('shows placeholders and no value when empty', () => {
    const html = renderToStaticMarkup(<MeasurementInput label="Height" locale="en-GB" />)
    expect(html).toContain('data-placeholder')
    expect(html).toContain('aria-valuetext="--"')
    expect(html).not.toContain('aria-valuenow')
  })

  it('omits aria-valuemax on the leading segment, server-side too', () => {
    const html = renderToStaticMarkup(
      <MeasurementInput label="Height" locale="en-GB" units={['foot', 'inch']} />,
    )
    // Only the inches segment has a ceiling to promise.
    expect(html.match(/aria-valuemax/g)).toHaveLength(1)
  })

  it('omits aria-valuemin on a temperature, which has no floor', () => {
    const html = renderToStaticMarkup(
      <MeasurementInput label="Fever" locale="en-GB" units={['celsius']} precision={1} />,
    )
    expect(html).not.toContain('aria-valuemin')
  })

  it('emits the hidden field a native form posts', () => {
    const html = renderToStaticMarkup(
      <MeasurementInput
        label="Height"
        locale="en-GB"
        units={['foot', 'inch']}
        name="height"
        defaultValue="71 inch"
      />,
    )
    expect(html).toContain('name="height"')
    expect(html).toContain('value="71 inch"')
    expect(html).toContain('type="hidden"')
  })

  it('omits the hidden field without a name', () => {
    expect(renderToStaticMarkup(<MeasurementInput label="H" locale="en-GB" />)).not.toContain(
      'data-rx-measurement-value',
    )
  })

  it('marks an out-of-range value on the server too', () => {
    const html = renderToStaticMarkup(
      <MeasurementInput
        label="H"
        locale="en-GB"
        units={['foot', 'inch']}
        min="2 meter"
        defaultValue="71 inch"
        onWarn={() => undefined}
      />,
    )
    expect(html).toContain('data-out-of-range')
  })

  it('does not throw on a value it cannot read', () => {
    for (const value of ['90 minute', '70 kilogram', '180', 'nonsense']) {
      expect(() =>
        renderToStaticMarkup(
          <MeasurementInput
            label="H"
            locale="en-GB"
            defaultValue={value}
            onWarn={() => undefined}
          />,
        ),
      ).not.toThrow()
    }
  })
})
