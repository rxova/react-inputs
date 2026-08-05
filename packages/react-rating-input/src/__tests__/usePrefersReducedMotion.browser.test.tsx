import { afterEach, describe, expect, it } from 'vitest'
import { render, renderHook } from 'vitest-browser-react'
import { page } from 'vitest/browser'
import { usePrefersReducedMotion } from '../usePrefersReducedMotion'
import { Rating } from '../Rating'

type MatchMedia = (query: string) => MediaQueryList
// Bound up front: reading it back off `window` later would be an unbound method.
const original: MatchMedia = window.matchMedia.bind(window)

function stubMatchMedia(matches: boolean) {
  const listeners = new Set<() => void>()
  const mql = {
    matches,
    media: '',
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  } as unknown as MediaQueryList
  window.matchMedia = () => mql
  return {
    mql,
    emitChange: (next: boolean) => {
      ;(mql as { matches: boolean }).matches = next
      for (const fn of listeners) fn()
    },
    listenerCount: () => listeners.size,
  }
}

afterEach(() => {
  window.matchMedia = original
})

describe('usePrefersReducedMotion', () => {
  it('reports false when the user has no preference', async () => {
    stubMatchMedia(false)
    const { result } = await renderHook(() => usePrefersReducedMotion())
    expect(result.current).toBe(false)
  })

  it('reports true when the user prefers reduced motion', async () => {
    stubMatchMedia(true)
    const { result } = await renderHook(() => usePrefersReducedMotion())
    expect(result.current).toBe(true)
  })

  it('reacts to a preference change and unsubscribes on unmount', async () => {
    const stub = stubMatchMedia(false)
    const { result, unmount } = await renderHook(() => usePrefersReducedMotion())
    expect(result.current).toBe(false)
    expect(stub.listenerCount()).toBe(1)

    stub.emitChange(true)
    await expect.poll(() => result.current).toBe(true)

    await unmount()
    expect(stub.listenerCount()).toBe(0)
  })

  it('falls back to false when matchMedia is missing', async () => {
    // jsdom has no matchMedia, and plenty of consumers still run their own
    // suites there. This branch is the reason the optional lookup exists.
    // @ts-expect-error deliberately removing a standard API
    delete window.matchMedia
    const { result } = await renderHook(() => usePrefersReducedMotion())
    expect(result.current).toBe(false)
  })

  it('renders without throwing when matchMedia is missing', async () => {
    // @ts-expect-error deliberately removing a standard API
    delete window.matchMedia
    await render(<Rating value={3} />)
    await expect.element(page.getByRole('img')).toBeInTheDocument()
  })
})

describe('reduced motion in Rating', () => {
  it('drops the fill transition when the user prefers reduced motion', async () => {
    stubMatchMedia(true)
    const { container } = await render(<Rating value={2.5} />)
    await expect.element(page.getByRole('img')).toBeInTheDocument()
    const fill = container.querySelector<HTMLElement>('[data-rx-rating-layer="fill"]')!
    expect(getComputedStyle(fill).transitionDuration).toBe('0s')
  })

  it('keeps the transition when there is no preference', async () => {
    stubMatchMedia(false)
    const { container } = await render(<Rating value={2.5} />)
    await expect.element(page.getByRole('img')).toBeInTheDocument()
    const fill = container.querySelector<HTMLElement>('[data-rx-rating-layer="fill"]')!
    expect(getComputedStyle(fill).transitionDuration).not.toBe('0s')
  })
})
