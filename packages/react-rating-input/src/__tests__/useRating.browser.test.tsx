import { describe, expect, it, vi } from 'vitest'
import { renderHook } from 'vitest-browser-react'
import type { FocusEvent } from 'react'
import { useRating } from '../useRating'

/**
 * `useRating` is exported from the package entry, so it is public API and
 * deserves direct tests rather than only being exercised through <Rating>.
 * These cover the guards the component itself never reaches.
 *
 * Deliberately no `act`: callbacks are invoked directly and any resulting state
 * is read through `expect.poll`, which retries until React has re-rendered.
 * Pulling `act` in would require setting IS_REACT_ACT_ENVIRONMENT, and React
 * then warns about every update that is *not* wrapped — trading three warnings
 * for a dozen.
 */

const focusEvent = (relatedTarget: EventTarget | null) =>
  ({ relatedTarget }) as unknown as FocusEvent<HTMLElement>

describe('useRating', () => {
  it('is not interactive without onChange', async () => {
    const { result } = await renderHook(() => useRating({ value: 3 }))
    expect(result.current.interactive).toBe(false)
    expect(result.current.canChange).toBe(false)
  })

  it('is interactive but not changeable when disabled', async () => {
    const { result } = await renderHook(() =>
      useRating({ value: 3, onChange: () => undefined, disabled: true }),
    )
    expect(result.current.interactive).toBe(true)
    expect(result.current.canChange).toBe(false)
    expect(result.current.disabled).toBe(true)
  })

  it('ignores commit and select when read-only', async () => {
    const onChange = vi.fn()
    const { result } = await renderHook(() => useRating({ value: 2, readOnly: true, onChange }))
    result.current.commit(4)
    result.current.select(4)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('ignores commit and select when disabled', async () => {
    const onChange = vi.fn()
    const { result } = await renderHook(() => useRating({ value: 2, onChange, disabled: true }))
    result.current.commit(4)
    result.current.select(4)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('ignores hover when not interactive', async () => {
    const onHoverChange = vi.fn()
    const { result } = await renderHook(() => useRating({ value: 2, onHoverChange }))
    result.current.setHover(4)
    expect(onHoverChange).not.toHaveBeenCalled()
    expect(result.current.hoverValue).toBeNull()
  })

  it('does not re-emit hover for an unchanged value', async () => {
    const onHoverChange = vi.fn()
    const { result } = await renderHook(() =>
      useRating({ value: 2, onChange: () => undefined, onHoverChange }),
    )
    result.current.setHover(4)
    await expect.poll(() => result.current.hoverValue).toBe(4)

    result.current.setHover(4)
    expect(onHoverChange).toHaveBeenCalledTimes(1)
  })

  it('clamps and snaps the incoming value', async () => {
    const { result } = await renderHook(() =>
      useRating({ value: 99, max: 5, precision: 1, rounding: 'nearest' }),
    )
    expect(result.current.value).toBe(5)
    expect(result.current.max).toBe(5)
  })

  it('commits verbatim while select toggles to zero', async () => {
    const onChange = vi.fn()
    const { result } = await renderHook(() => useRating({ value: 3, onChange, precision: 1 }))

    result.current.commit(3)
    expect(onChange).toHaveBeenLastCalledWith(3)

    result.current.select(3)
    expect(onChange).toHaveBeenLastCalledWith(0)
  })

  it('does not toggle to zero when allowClear is false', async () => {
    const onChange = vi.fn()
    const { result } = await renderHook(() =>
      useRating({ value: 3, onChange, precision: 1, allowClear: false }),
    )
    result.current.select(3)
    expect(onChange).toHaveBeenLastCalledWith(3)
  })

  it('tracks an uncontrolled value internally', async () => {
    const { result } = await renderHook(() =>
      useRating({ defaultValue: 1, onChange: () => undefined, precision: 1 }),
    )
    result.current.commit(4)
    await expect.poll(() => result.current.value).toBe(4)
  })

  it('generates a stable group name when none is given', async () => {
    const { result } = await renderHook(() => useRating({ value: 1, onChange: () => undefined }))
    expect(result.current.name).toMatch(/^rx-rating-name-/)
    expect(result.current.baseId).toMatch(/^rx-rating-/)
  })

  it('emits blur without a hover to clear', async () => {
    const onBlur = vi.fn()
    const onHoverChange = vi.fn()
    const { result } = await renderHook(() =>
      useRating({ value: 1, onChange: () => undefined, onBlur, onHoverChange }),
    )
    result.current.handleBlur(focusEvent(null))

    expect(onBlur).toHaveBeenCalledTimes(1)
    // Nothing was hovered, so there is no spurious null hover event.
    expect(onHoverChange).not.toHaveBeenCalled()
  })

  it('swallows blur when focus stays inside the group', async () => {
    const onBlur = vi.fn()
    const { result } = await renderHook(() =>
      useRating({ value: 1, onChange: () => undefined, onBlur }),
    )

    const root = document.createElement('span')
    const inner = document.createElement('input')
    root.appendChild(inner)
    document.body.appendChild(root)
    result.current.rootRef.current = root

    result.current.handleBlur(focusEvent(inner))
    expect(onBlur).not.toHaveBeenCalled()
    root.remove()
  })

  it('clears a live hover preview when focus leaves', async () => {
    const onHoverChange = vi.fn()
    const { result } = await renderHook(() =>
      useRating({ value: 1, onChange: () => undefined, onHoverChange }),
    )
    result.current.setHover(4)
    await expect.poll(() => result.current.hoverValue).toBe(4)

    result.current.handleBlur(focusEvent(null))
    await expect.poll(() => result.current.hoverValue).toBeNull()
    expect(onHoverChange).toHaveBeenLastCalledWith(null)
  })
})
