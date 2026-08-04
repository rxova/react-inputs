import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { PasswordInput } from '../PasswordInput'
import { commonRules } from '../rules'

/**
 * Runs in the node project, where `window` genuinely does not exist. This is
 * the only place the SSR path runs for real: `useIsomorphicLayoutEffect`
 * swapping to `useEffect` so React logs no "useLayoutEffect does nothing on the
 * server" warning, and `toggleReveal`'s `document.activeElement` read staying
 * behind an effect that never fires. The README claims SSR/RSC safety; without
 * this file that claim is untested.
 */
describe('server rendering', () => {
  it('renders a masked field with its toggle and no DOM access', () => {
    const html = renderToStaticMarkup(<PasswordInput label="Password" />)
    expect(html).toContain('data-rpi-root')
    expect(html).toContain('type="password"')
    expect(html).toContain('data-rpi-toggle')
    expect(html).toContain('aria-pressed="false"')
  })

  it('emits a controlled value into the markup', () => {
    const html = renderToStaticMarkup(<PasswordInput value="hunter2" onChange={() => undefined} />)
    expect(html).toContain('value="hunter2"')
  })

  it('honours defaultRevealed on the very first paint, with no flash of masked text', () => {
    const html = renderToStaticMarkup(
      <PasswordInput defaultRevealed value="abc" onChange={() => undefined} />,
    )
    expect(html).toContain('type="text"')
    expect(html).toContain('aria-pressed="true"')
  })

  it('posts under its name with the autocomplete a password manager needs', () => {
    const html = renderToStaticMarkup(<PasswordInput name="password" autoComplete="new-password" />)
    expect(html).toContain('name="password"')
    // Matched case-insensitively: React 19 serialises this one as `autoComplete`
    // rather than lowercasing it. HTML attribute names are case-insensitive so
    // browsers and password managers are unaffected, but a literal comparison
    // here would be asserting React's serialiser, not our markup.
    expect(html.toLowerCase()).toContain('autocomplete="new-password"')
  })

  it('renders the meter and the checklist server-side', () => {
    const html = renderToStaticMarkup(
      <PasswordInput
        value="abc"
        onChange={() => undefined}
        showStrength
        rules={[commonRules.lowercase, commonRules.digit]}
      />,
    )
    expect(html).toContain('role="meter"')
    expect(html).toContain('data-rule="lowercase"')
    expect(html).toContain('data-rule="digit"')
    // The lowercase rule is met, the digit rule is not.
    expect(html).toContain('data-met=""')
  })

  it('omits the toggle entirely when asked', () => {
    const html = renderToStaticMarkup(<PasswordInput hideRevealToggle />)
    expect(html).not.toContain('data-rpi-toggle')
  })

  it('never emits an aria-describedby pointing at an element it did not render', () => {
    // A dangling describedby is a WCAG failure, and the meter and checklist are
    // both opt-in — so the attribute has to be assembled from what exists.
    const html = renderToStaticMarkup(<PasswordInput label="Password" />)
    expect(html).not.toContain('aria-describedby')
  })
})
