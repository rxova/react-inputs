import { describe, expect, it, vi } from 'vitest'
import { renderHook } from 'vitest-browser-react'
import { useSeatMap } from '../useSeatMap'
import { parseLayout } from '../layout'
import type { SeatMapSection } from '../types'

/**
 * The hook is published so a venue can build a completely custom renderer
 * without reimplementing the fiddly parts, which makes its return value public
 * API. `act` is deliberately absent: callbacks are invoked directly and any
 * resulting state is read through `expect.poll`. Pulling `act` in would require
 * setting IS_REACT_ACT_ENVIRONMENT, and React then warns about every update
 * that is not wrapped — trading three warnings for a dozen.
 */

const CABIN: SeatMapSection[] = parseLayout(`
  10: ##_##
  11: #x_##
  12: ##_##
`)

describe('layout', () => {
  it('indexes the sections it is given', async () => {
    const { result } = await renderHook(() => useSeatMap({ sections: CABIN }))
    expect(result.current.grid.order).toHaveLength(12)
    expect(result.current.grid.sections).toHaveLength(1)
  })

  it('wraps the `rows` shorthand in a real section', async () => {
    const { result } = await renderHook(() =>
      useSeatMap({ rows: [{ label: '1', cells: [{ id: '1A' }] }] }),
    )
    expect(result.current.grid.sections[0]).toMatchObject({ id: 'seats', label: 'Seats' })
  })

  it('prefers `sections` when both are given', async () => {
    const { result } = await renderHook(() =>
      useSeatMap({ sections: CABIN, rows: [{ label: 'x', cells: [{ id: 'x' }] }] }),
    )
    expect(result.current.grid.byId.has('x')).toBe(false)
  })

  it('copes with neither', async () => {
    const { result } = await renderHook(() => useSeatMap({ onWarn: () => undefined }))
    expect(result.current.grid.order).toEqual([])
    expect(result.current.tabbableIds).toEqual([])
  })
})

describe('value', () => {
  it('drops ids the layout does not know', async () => {
    const { result } = await renderHook(() =>
      useSeatMap({ sections: CABIN, value: ['10A', 'nope'], onWarn: () => undefined }),
    )
    expect(result.current.value).toEqual(['10A'])
    expect(result.current.selectedSeats.map((seat) => seat.id)).toEqual(['10A'])
  })

  it('drops repeats, so one seat cannot be booked twice', async () => {
    const { result } = await renderHook(() =>
      useSeatMap({ sections: CABIN, value: ['10A', '10A'] }),
    )
    expect(result.current.value).toEqual(['10A'])
  })

  it('keeps its own state when uncontrolled', async () => {
    const { result } = await renderHook(() =>
      useSeatMap({ sections: CABIN, defaultValue: ['10A'], onChange: () => undefined }),
    )
    result.current.toggle('10B')
    await expect.poll(() => result.current.value).toEqual(['10A', '10B'])
  })

  it('leaves state to the owner when controlled', async () => {
    const onChange = vi.fn()
    const { result } = await renderHook(() => useSeatMap({ sections: CABIN, value: [], onChange }))
    result.current.toggle('10B')
    expect(onChange).toHaveBeenCalledWith(['10B'], [expect.objectContaining({ id: '10B' })])
    await expect.poll(() => result.current.value).toEqual([])
  })

  it('replaces the whole selection through setSelection, skipping the rules', async () => {
    const { result } = await renderHook(() =>
      useSeatMap({ sections: CABIN, onChange: () => undefined, contiguous: true }),
    )
    result.current.setSelection(['10A', '12D', 'nope'])
    await expect.poll(() => result.current.value).toEqual(['10A', '12D'])
  })
})

describe('modes', () => {
  it('is read-only until onChange arrives', async () => {
    const { result } = await renderHook(() => useSeatMap({ sections: CABIN }))
    expect(result.current.interactive).toBe(false)
    expect(result.current.canChange).toBe(false)
  })

  it('stays interactive but unchangeable when disabled', async () => {
    const { result } = await renderHook(() =>
      useSeatMap({ sections: CABIN, onChange: () => undefined, disabled: true }),
    )
    expect(result.current.interactive).toBe(true)
    expect(result.current.canChange).toBe(false)
  })

  it('ignores toggles it cannot honour', async () => {
    const onChange = vi.fn()
    const { result } = await renderHook(() =>
      useSeatMap({ sections: CABIN, onChange, disabled: true }),
    )
    result.current.toggle('10A')
    result.current.setSelection(['10A'])
    result.current.setHovered('10A')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('ignores a toggle for a seat that is not there', async () => {
    const onChange = vi.fn()
    const { result } = await renderHook(() => useSeatMap({ sections: CABIN, onChange }))
    result.current.toggle('nope')
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('limits', () => {
  it('reports how many seats are left', async () => {
    const { result } = await renderHook(() =>
      useSeatMap({ sections: CABIN, value: ['10A'], maxSeats: 3, onChange: () => undefined }),
    )
    expect(result.current.remaining).toBe(2)
  })

  it('reports no limit when there is none', async () => {
    const { result } = await renderHook(() => useSeatMap({ sections: CABIN }))
    expect(result.current.remaining).toBeNull()
  })

  it('ignores a cap that is not a positive integer', async () => {
    const { result } = await renderHook(() =>
      useSeatMap({ sections: CABIN, maxSeats: 0, onWarn: () => undefined }),
    )
    expect(result.current.remaining).toBeNull()
  })

  it('treats `required` as a minimum of one', async () => {
    const { result } = await renderHook(() => useSeatMap({ sections: CABIN, required: true }))
    expect(result.current.minSeats).toBe(1)
    expect(result.current.belowMinimum).toBe(true)
  })

  it('lets minSeats win over required', async () => {
    const { result } = await renderHook(() =>
      useSeatMap({ sections: CABIN, required: true, minSeats: 3, value: ['10A'] }),
    )
    expect(result.current.minSeats).toBe(3)
    expect(result.current.belowMinimum).toBe(true)
  })
})

describe('navigation', () => {
  it('resolves each move to a seat id', async () => {
    const { result } = await renderHook(() => useSeatMap({ sections: CABIN }))
    const { resolveMove } = result.current
    expect(resolveMove('10B', 'right')).toBe('10C')
    expect(resolveMove('10C', 'left')).toBe('10B')
    expect(resolveMove('10A', 'down')).toBe('11A')
    expect(resolveMove('11A', 'up')).toBe('10A')
    expect(resolveMove('10C', 'row-start')).toBe('10A')
    expect(resolveMove('10A', 'row-end')).toBe('10D')
    expect(resolveMove('11C', 'section-start')).toBe('10A')
    expect(resolveMove('11C', 'section-end')).toBe('12D')
  })

  it('returns null when a move cannot land anywhere new', async () => {
    const { result } = await renderHook(() => useSeatMap({ sections: CABIN }))
    expect(result.current.resolveMove('10A', 'left')).toBeNull()
    expect(result.current.resolveMove('10A', 'section-start')).toBeNull()
    expect(result.current.resolveMove('nope', 'right')).toBeNull()
  })

  it('pages by the requested number of rows', async () => {
    const tall = parseLayout(
      Array.from({ length: 8 }, (_, index) => `${String(index + 1)}: ##`).join('\n'),
    )
    const { result } = await renderHook(() => useSeatMap({ sections: tall, pageSize: 3 }))
    expect(result.current.resolveMove('1A', 'page-down')).toBe('4A')
    expect(result.current.resolveMove('8A', 'page-up')).toBe('5A')
  })
})

describe('roving tabindex', () => {
  it('offers the first choosable seat when nothing is chosen', async () => {
    const { result } = await renderHook(() => useSeatMap({ sections: parseLayout('1: xx##') }))
    expect(result.current.tabbableIds).toEqual(['1C'])
  })

  it('offers the chosen seat once there is one', async () => {
    const { result } = await renderHook(() => useSeatMap({ sections: CABIN, value: ['12D'] }))
    expect(result.current.tabbableIds).toEqual(['12D'])
  })

  it('follows focus', async () => {
    const { result } = await renderHook(() => useSeatMap({ sections: CABIN }))
    result.current.setFocused('11D', true)
    await expect.poll(() => result.current.tabbableIds).toEqual(['11D'])
  })

  it('falls back to a sold seat rather than leaving a block untabbable', async () => {
    const { result } = await renderHook(() => useSeatMap({ sections: parseLayout('1: xx') }))
    expect(result.current.tabbableIds).toEqual(['1A'])
  })

  it('reports null for a section with no seats', async () => {
    const { result } = await renderHook(() =>
      useSeatMap({ sections: [{ id: 'e', label: 'E', rows: [{ label: '1', cells: [null] }] }] }),
    )
    expect(result.current.tabbableIds).toEqual([null])
  })

  it('offers one seat per section', async () => {
    const { result } = await renderHook(() =>
      useSeatMap({ sections: parseLayout('Stalls\n1: ##\nCircle\n5: ##') }),
    )
    expect(result.current.tabbableIds).toEqual(['stalls-1A', 'circle-5A'])
  })
})

describe('hover', () => {
  it('reports transitions only, and hands over the seat', async () => {
    const onHoverChange = vi.fn()
    const { result } = await renderHook(() =>
      useSeatMap({ sections: CABIN, onChange: () => undefined, onHoverChange }),
    )
    result.current.setHovered('10A')
    result.current.setHovered('10A')
    await expect.poll(() => result.current.hoveredId).toBe('10A')
    expect(onHoverChange).toHaveBeenCalledTimes(1)
    expect(onHoverChange).toHaveBeenCalledWith(expect.objectContaining({ id: '10A' }))
  })

  it('reports null for a seat it does not know', async () => {
    const onHoverChange = vi.fn()
    const { result } = await renderHook(() =>
      useSeatMap({ sections: CABIN, onChange: () => undefined, onHoverChange }),
    )
    result.current.setHovered('nope')
    expect(onHoverChange).toHaveBeenCalledWith(null)
  })
})

describe('identity', () => {
  it('generates a name and a base id when none are given', async () => {
    const { result } = await renderHook(() => useSeatMap({ sections: CABIN }))
    expect(result.current.name).toMatch(/^rx-seat-map-name-/)
    expect(result.current.baseId).toMatch(/^rx-seat-map-/)
  })

  it('takes the ones it is given', async () => {
    const { result } = await renderHook(() =>
      useSeatMap({ sections: CABIN, name: 'seats', id: 'booking' }),
    )
    expect(result.current.name).toBe('seats')
    expect(result.current.baseId).toBe('booking')
  })
})
