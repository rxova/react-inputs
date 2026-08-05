import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup, renderToString } from 'react-dom/server'
import { OtpInput } from '../OtpInput'
import { OtpGroup } from '../OtpGroup'
import { OtpSlot } from '../OtpSlot'
import { OtpSeparator } from '../OtpSeparator'

/**
 * Runs in the node project, where `window` genuinely does not exist. This is
 * the only place the SSR paths run for real: `useSyncExternalStore`'s server
 * snapshot (spatial default), the `typeof window/document` guards behind the
 * caret injection and iOS detection, and `useIsomorphicLayoutEffect` swapping to
 * `useEffect` so no "useLayoutEffect does nothing on the server" warning fires.
 * The README claims SSR/RSC safety; without this file that claim is untested.
 */
describe('server rendering', () => {
  it('renders one real input plus decorative slots without a DOM', () => {
    const html = renderToStaticMarkup(<OtpInput length={6} label="Code" />)
    expect(html).toContain('data-rx-otp-root')
    expect(html).toContain('data-rx-otp-input')
    expect(html).toContain('aria-label="Code"')
    // Six painted slots, all hidden from the a11y tree.
    expect(html.match(/data-rx-otp-slot/g)).toHaveLength(6)
    expect(html).toContain('aria-hidden="true"')
  })

  it('sanitizes a controlled value into the markup, never throwing on garbage', () => {
    const html = renderToStaticMarkup(<OtpInput value={'12ab34' as string} label="Code" />)
    // Numeric mode drops the letters; the input value is the cleaned code.
    expect(html).toContain('value="1234"')
  })

  it('posts under its name as a single native field', () => {
    const html = renderToStaticMarkup(<OtpInput name="otp" defaultValue="123" label="Code" />)
    expect(html).toContain('name="otp"')
    expect(html).toContain('one-time-code')
  })

  it('renders the compound composition server-side', () => {
    const html = renderToStaticMarkup(
      <OtpInput length={6} label="Code">
        <OtpGroup>
          <OtpSlot index={0} />
          <OtpSlot index={1} />
          <OtpSlot index={2} />
        </OtpGroup>
        <OtpSeparator />
        <OtpGroup>
          <OtpSlot index={3} />
          <OtpSlot index={4} />
          <OtpSlot index={5} />
        </OtpGroup>
      </OtpInput>,
    )
    expect(html).toContain('data-rx-otp-group')
    expect(html).toContain('data-rx-otp-separator')
    expect(html.match(/data-rx-otp-slot/g)).toHaveLength(6)
  })

  it('does not throw for any documented mode / mask / length combination', () => {
    for (const mode of ['numeric', 'alphanumeric', 'alpha'] as const) {
      for (const mask of [false, true, '*']) {
        for (const length of [4, 6, 8]) {
          expect(() =>
            renderToString(<OtpInput mode={mode} mask={mask} length={length} label="Code" />),
          ).not.toThrow()
        }
      }
    }
  })

  it('emits translate="no" so Chrome auto-translate cannot corrupt the field', () => {
    const html = renderToStaticMarkup(<OtpInput label="Code" />)
    expect(html).toContain('translate="no"')
  })
})
