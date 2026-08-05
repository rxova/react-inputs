import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from 'vitest-browser-react'
import { useRating } from '../useRating'

/**
 * The development-warning effect: it routes coercions to `onWarn` (or
 * console.warn), dedupes them, never suppresses the coercion itself, and
 * vanishes entirely in production.
 */

describe('useRating — development warnings', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('warns when value exceeds max, and still paints max', async () => {
    const onWarn = vi.fn()
    const { result } = await renderHook(() => useRating({ value: 7, max: 5, onWarn }))

    await expect.poll(() => onWarn.mock.calls.length).toBe(1)
    expect(onWarn).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'value-above-max', received: 7, used: 5 }),
    )
    // Functionality is preserved: the value is still clamped for rendering.
    expect(result.current.value).toBe(5)
  })

  it.each([
    [-1, 'value-negative', 0],
    [Number.NaN, 'value-non-finite', 0],
    [Number.POSITIVE_INFINITY, 'value-non-finite', 0],
  ] as const)('warns %p as %s and clamps to %p', async (value, code, used) => {
    const onWarn = vi.fn()
    const { result } = await renderHook(() => useRating({ value, max: 5, onWarn }))

    await expect.poll(() => onWarn.mock.calls.length).toBe(1)
    expect(onWarn).toHaveBeenCalledWith(expect.objectContaining({ code }))
    expect(result.current.value).toBe(used)
  })

  it('warns on a non-integer max and normalizes it', async () => {
    const onWarn = vi.fn()
    const { result } = await renderHook(() => useRating({ value: 3, max: 4.7, onWarn }))

    await expect.poll(() => onWarn.mock.calls.length).toBe(1)
    expect(onWarn).toHaveBeenCalledWith(expect.objectContaining({ code: 'max-non-integer' }))
    expect(result.current.max).toBe(4)
  })

  it('blames defaultValue rather than value when uncontrolled', async () => {
    const onWarn = vi.fn()
    await renderHook(() =>
      useRating({ defaultValue: 9, max: 5, onChange: () => undefined, onWarn }),
    )

    await expect.poll(() => onWarn.mock.calls.length).toBe(1)
    expect(onWarn).toHaveBeenCalledWith(expect.objectContaining({ prop: 'defaultValue' }))
  })

  it('falls back to console.warn when no handler is given', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    await renderHook(() => useRating({ value: 7, max: 5 }))

    await expect.poll(() => warn.mock.calls.length).toBe(1)
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/^\[react-rating-input\].*exceeds/))
  })

  it('does not warn for in-range props', async () => {
    const onWarn = vi.fn()
    await renderHook(() => useRating({ value: 3, max: 5, onWarn }))
    // Give the effect a chance to run before asserting it stayed silent.
    await new Promise((r) => setTimeout(r, 0))
    expect(onWarn).not.toHaveBeenCalled()
  })

  it('warns once per distinct bad value across re-renders', async () => {
    const onWarn = vi.fn()
    const { rerender } = await renderHook(
      (props?: { value: number }) => useRating({ value: props?.value ?? 7, max: 5, onWarn }),
      { initialProps: { value: 7 } },
    )

    await expect.poll(() => onWarn.mock.calls.length).toBe(1) // 7
    await rerender({ value: 8 })
    await expect.poll(() => onWarn.mock.calls.length).toBe(2) // 8, a new offender
    await rerender({ value: 7 })
    // 7 was already reported; re-seeing it must not warn again.
    await new Promise((r) => setTimeout(r, 0))
    expect(onWarn.mock.calls.length).toBe(2)
  })

  // The production-silence path (`process.env.NODE_ENV === 'production'`) is
  // folded to a constant and dropped at bundle time, so it cannot be toggled
  // at runtime in this always-development test build. It is covered instead by
  // the size budget, which measures the stripped production output.
})
