import { useSyncExternalStore } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

/**
 * `window.matchMedia` is typed as always present, but it genuinely is not:
 * jsdom omits it, and plenty of consumers still run their own suites there.
 * Reaching for it through an optional shape keeps the guard real without a
 * lint suppression.
 *
 * The `typeof window` arm is not reachable through <SeatMap>: useSyncExternalStore
 * uses getServerSnapshot on the server, so this only ever runs client-side. It
 * stays for non-DOM renderers (react-test-renderer in node), and is covered by
 * a direct unit test rather than through the component.
 */
/** @internal Exported for tests; not part of the public API (see index.ts). */
export function getMatchMedia(): ((query: string) => MediaQueryList) | undefined {
  if (typeof window === 'undefined') return undefined
  const { matchMedia } = window as { matchMedia?: (query: string) => MediaQueryList }
  return matchMedia?.bind(window)
}

/** @internal */
export function subscribe(onChange: () => void): () => void {
  const mql = getMatchMedia()?.(QUERY)
  if (!mql) return () => undefined
  mql.addEventListener('change', onChange)
  return () => {
    mql.removeEventListener('change', onChange)
  }
}

/** @internal */
export function getSnapshot(): boolean {
  return getMatchMedia()?.(QUERY).matches ?? false
}

/**
 * The colour transition as a seat changes state is the component's only
 * animation, and it is decorative. (Keyboard focus scrolls with
 * `behavior: 'auto'` unconditionally — smooth scrolling under repeated arrow
 * keys is unpleasant for everyone, not only for people who asked for less
 * motion.) Inline styles cannot express a media query, so the preference is
 * read in JS. The server snapshot is `false` so SSR markup matches the
 * no-preference default and hydration stays quiet.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
