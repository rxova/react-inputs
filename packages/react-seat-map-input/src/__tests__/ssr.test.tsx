import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup, renderToString } from 'react-dom/server'
import { SeatMap } from '../SeatMap'
import { parseLayout } from '../layout'

/**
 * Runs in the node project, where `window` genuinely does not exist. That makes
 * this the only place the SSR paths are exercised for real:
 * `useSyncExternalStore`'s server snapshot in usePrefersReducedMotion, the
 * `typeof window === 'undefined'` guard behind it, and the `getComputedStyle`
 * call in the key handler never running during render. The README claims SSR
 * safety; without this file that claim is untested.
 */
const ROW = parseLayout('12: ##_#x')

describe('server rendering', () => {
  it('renders a read-only map as a grid without a DOM', () => {
    const html = renderToStaticMarkup(<SeatMap sections={ROW} label="Your seats" />)
    expect(html).toContain('role="grid"')
    expect(html).toContain('role="gridcell"')
    expect(html).toContain('aria-readonly="true"')
    expect(html).toContain('data-rx-seat-map-root')
  })

  it('renders an interactive map as real checkboxes', () => {
    const html = renderToStaticMarkup(
      <SeatMap sections={ROW} name="seats" onChange={() => undefined} label="Seats" />,
    )
    expect(html).toContain('type="checkbox"')
    expect(html).toContain('name="seats"')
    expect(html).not.toContain('aria-readonly')
  })

  it('marks the chosen seats server-side, so there is no flash of an empty map', () => {
    const html = renderToStaticMarkup(
      <SeatMap sections={ROW} value={['12A']} onChange={() => undefined} label="Seats" />,
    )
    expect(html).toContain('checked')
    expect(html).toContain('data-state="selected"')
  })

  it('states an unavailable seat without the disabled attribute', () => {
    const html = renderToStaticMarkup(
      <SeatMap sections={ROW} onChange={() => undefined} label="Seats" />,
    )
    // `disabled` would make the sold seat unreachable by keyboard, which is the
    // defect this component exists to avoid.
    expect(html).toContain('aria-disabled="true"')
    expect(html).not.toContain('disabled=""')
  })

  it('assumes no motion preference on the server so hydration stays quiet', () => {
    const html = renderToStaticMarkup(<SeatMap sections={ROW} label="Seats" />)
    expect(html).toContain('transition:')
  })

  it('renders an empty map rather than throwing', () => {
    expect(() => renderToString(<SeatMap sections={[]} label="Seats" />)).not.toThrow()
  })

  it('does not throw for any documented rule combination', () => {
    for (const contiguous of [true, false]) {
      for (const noOrphanSeats of [true, false]) {
        expect(() =>
          renderToString(
            <SeatMap
              sections={ROW}
              onChange={() => undefined}
              contiguous={contiguous}
              noOrphanSeats={noOrphanSeats}
              maxSeats={2}
              minSeats={1}
              label="Seats"
            />,
          ),
        ).not.toThrow()
      }
    }
  })
})
