import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup, renderToString } from 'react-dom/server'
import { Rating } from '../Rating'

/**
 * Runs in the node project, where `window` genuinely does not exist. That makes
 * this the only place the SSR paths are exercised for real: `useSyncExternalStore`'s
 * server snapshot in usePrefersReducedMotion, and the `typeof window === 'undefined'`
 * guard behind it. The README claims SSR safety; without this file that claim
 * is untested.
 */
describe('server rendering', () => {
  it('renders read-only markup without a DOM', () => {
    const html = renderToStaticMarkup(<Rating value={4.3} />)
    expect(html).toContain('role="img"')
    expect(html).toContain('aria-label="4.3 out of 5"')
    expect(html).toContain('data-rx-rating-root')
  })

  it('renders the partial fill width server-side', () => {
    const html = renderToStaticMarkup(<Rating value={4.3} />)
    // The fifth icon carries the fractional width, so hydration has nothing to
    // correct and there is no flash of a wrong rating.
    expect(html).toMatch(/width:\s*30(\.0+)?%/)
  })

  it('renders an interactive rating as a radiogroup with real inputs', () => {
    const html = renderToStaticMarkup(
      <Rating value={3} onChange={() => undefined} precision={1} name="score" label="Rate" />,
    )
    expect(html).toContain('role="radiogroup"')
    expect(html).toContain('type="radio"')
    expect(html).toContain('name="score"')
    expect(html).toContain('checked')
  })

  it('assumes no motion preference on the server so hydration stays quiet', () => {
    // getServerSnapshot returns false, so the server emits the transition and
    // the client only diverges if the user actually prefers reduced motion.
    const html = renderToStaticMarkup(<Rating value={2} />)
    expect(html).toContain('transition:')
  })

  it('does not throw for any documented rounding combination', () => {
    for (const precision of [0, 0.1, 0.5, 1]) {
      for (const rounding of ['nearest', 'down', 'up', 'none'] as const) {
        expect(() =>
          renderToString(<Rating value={3.7} precision={precision} rounding={rounding} />),
        ).not.toThrow()
      }
    }
  })

  it('renders emoji icons server-side', () => {
    const html = renderToStaticMarkup(<Rating value={2.5} icon="⭐" />)
    expect(html).toContain('⭐')
  })
})
