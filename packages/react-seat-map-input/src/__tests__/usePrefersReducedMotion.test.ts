import { afterEach, describe, expect, it } from 'vitest'
import { getMatchMedia, getSnapshot, subscribe } from '../usePrefersReducedMotion'

/**
 * Runs in the node project, where `window` does not exist at all. That makes it
 * the only place the no-DOM guards can be exercised: through <SeatMap> they are
 * unreachable, because useSyncExternalStore takes the getServerSnapshot path on
 * the server and never calls these.
 *
 * They still matter for consumers rendering with a non-DOM renderer
 * (react-test-renderer under node), which does call getSnapshot.
 */
describe('no-DOM guards', () => {
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window
  })

  it('has no window in this environment', () => {
    expect(typeof window).toBe('undefined')
  })

  it('getMatchMedia returns undefined without a window', () => {
    expect(getMatchMedia()).toBeUndefined()
  })

  it('getSnapshot reports no preference rather than throwing', () => {
    expect(getSnapshot()).toBe(false)
  })

  it('subscribe returns a no-op unsubscribe that is safe to call', () => {
    const unsubscribe = subscribe(() => undefined)
    expect(typeof unsubscribe).toBe('function')
    expect(() => {
      unsubscribe()
    }).not.toThrow()
  })

  it('finds matchMedia once a window-like global appears', () => {
    const mql = { matches: true } as MediaQueryList
    ;(globalThis as { window?: unknown }).window = {
      matchMedia: () => mql,
    }
    expect(getMatchMedia()).toBeTypeOf('function')
    expect(getSnapshot()).toBe(true)
  })

  it('tolerates a window without matchMedia, as jsdom provides', () => {
    ;(globalThis as { window?: unknown }).window = {}
    expect(getMatchMedia()).toBeUndefined()
    expect(getSnapshot()).toBe(false)
  })
})
