import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { PhoneInput } from '../PhoneInput'

/**
 * Runs in the node project, where `window` genuinely does not exist. This is
 * the only place the SSR path runs for real: `useIsomorphicLayoutEffect`
 * swapping to `useEffect` so React logs no "useLayoutEffect does nothing on the
 * server" warning, and the `document.activeElement` read inside the caret
 * restore staying behind an effect that never fires. The README claims SSR/RSC
 * safety; without this file that claim is untested.
 */
describe('server rendering', () => {
  it('renders the field and the country select without a DOM', () => {
    const html = renderToStaticMarkup(<PhoneInput label="Phone" countries={['GB', 'US']} />)
    expect(html).toContain('data-rphi-root')
    expect(html).toContain('data-rphi-input')
    expect(html).toContain('data-rphi-country')
    expect(html).toContain('type="tel"')
  })

  it('paints a value on the first frame, already formatted', () => {
    const html = renderToStaticMarkup(
      <PhoneInput label="Phone" value="+14155552671" onChange={() => undefined} />,
    )
    expect(html).toContain('+1 415 555 2671')
  })

  it('resolves the country from the value server-side', () => {
    const html = renderToStaticMarkup(
      <PhoneInput label="Phone" defaultValue="+442071234567" countries={['GB', 'US']} />,
    )
    expect(html).toContain('data-country="GB"')
  })

  it('emits the hidden field a native form posts', () => {
    const html = renderToStaticMarkup(
      <PhoneInput label="Phone" name="phone" defaultValue="+14155552671" />,
    )
    expect(html).toContain('name="phone"')
    expect(html).toContain('value="+14155552671"')
    expect(html).toContain('type="hidden"')
  })

  it('omits the hidden field without a name', () => {
    const html = renderToStaticMarkup(<PhoneInput label="Phone" />)
    expect(html).not.toContain('data-rphi-value')
  })

  it('omits the country select when asked', () => {
    const html = renderToStaticMarkup(<PhoneInput label="Phone" hideCountrySelect />)
    expect(html).not.toContain('data-rphi-country')
  })

  it('resolves country names from Intl on the server too', () => {
    // Node ships full ICU, so the names are real rather than ISO fallbacks.
    const html = renderToStaticMarkup(
      <PhoneInput label="Phone" countries={['DE']} defaultCountry="DE" locale="en" />,
    )
    expect(html).toContain('Germany')
  })
})
