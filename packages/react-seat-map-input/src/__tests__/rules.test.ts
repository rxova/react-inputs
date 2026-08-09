import { describe, expect, it, vi } from 'vitest'
import { buildGrid } from '../geometry'
import { applySelection, contextFor, countOrphans, findBestSeats, isContiguous } from '../rules'
import { parseLayout } from '../layout'
import type { SeatMapSection } from '../types'

/**
 * The rule engine is the part of this component nothing else on npm has, so it
 * is pinned exhaustively and as pure data. Every case here is a real booking
 * rule someone has had to explain to a customer.
 */

const ROW = parseLayout('12: ###_###')
const grid = (sections: SeatMapSection[] = ROW) => buildGrid(sections)
const ids = (result: { next: string[] }) => result.next

describe('isContiguous', () => {
  it('accepts nothing and a single seat', () => {
    const g = grid()
    expect(isContiguous(g, [])).toBe(true)
    expect(isContiguous(g, ['12A'])).toBe(true)
  })

  it('accepts a consecutive run in any order', () => {
    const g = grid()
    expect(isContiguous(g, ['12B', '12A'])).toBe(true)
  })

  it('rejects a hole in the run', () => {
    const g = grid()
    expect(isContiguous(g, ['12A', '12C'])).toBe(false)
  })

  it('treats the aisle as a break, because it is one in the cabin', () => {
    const g = grid()
    // 12C and 12D are adjacent letters but sit either side of the aisle.
    expect(isContiguous(g, ['12C', '12D'])).toBe(false)
  })

  it('rejects seats in different rows', () => {
    const g = grid(parseLayout('12: ##\n13: ##'))
    expect(isContiguous(g, ['12A', '13A'])).toBe(false)
  })

  it('rejects seats in different sections', () => {
    const g = grid(parseLayout('Stalls\n1: ##\nCircle\n5: ##'))
    expect(isContiguous(g, ['stalls-1A', 'circle-5A'])).toBe(false)
    expect(isContiguous(g, ['stalls-1A', 'stalls-1B'])).toBe(true)
  })

  it('ignores ids the layout does not know', () => {
    const g = grid()
    expect(isContiguous(g, ['12A', 'nope'])).toBe(true)
  })
})

describe('countOrphans', () => {
  const rowOf = (spec: string) => {
    const section = buildGrid(parseLayout(`1: ${spec}`)).sections[0]
    const row = section?.rows[0]
    if (!row) throw new Error('fixture has no row')
    return row
  }

  it('counts a lone free seat between two sold ones', () => {
    expect(countOrphans(rowOf('x#x'), new Set())).toBe(1)
  })

  it('counts a lone free seat at the end of a row', () => {
    expect(countOrphans(rowOf('xx#'), new Set())).toBe(1)
  })

  it('does not count a pair', () => {
    expect(countOrphans(rowOf('x##x'), new Set())).toBe(0)
  })

  it('treats an aisle as a wall', () => {
    expect(countOrphans(rowOf('#_#'), new Set())).toBe(2)
  })

  it('treats a selected seat as taken', () => {
    expect(countOrphans(rowOf('###'), new Set(['1B']))).toBe(2)
  })

  it('counts several orphans in one row', () => {
    expect(countOrphans(rowOf('#x#x#'), new Set())).toBe(3)
  })
})

describe('applySelection', () => {
  it('adds an available seat', () => {
    expect(ids(applySelection(grid(), [], '12A'))).toEqual(['12A'])
  })

  it('removes a seat that is already chosen', () => {
    expect(ids(applySelection(grid(), ['12A', '12B'], '12A'))).toEqual(['12B'])
  })

  it('ignores an id the layout does not know', () => {
    const result = applySelection(grid(), ['12A'], 'nope')
    expect(result.next).toEqual(['12A'])
    expect(result.rejection).toBeUndefined()
  })

  it('refuses a sold seat and says which kind of gone it is', () => {
    const g = grid(parseLayout('12: #xo.'))
    expect(applySelection(g, [], '12B').rejection).toMatchObject({
      reason: 'unavailable',
      message: '12B is already taken.',
    })
    expect(applySelection(g, [], '12C').rejection?.message).toBe('12C is on hold.')
    expect(applySelection(g, [], '12D').rejection?.message).toBe('12D is not available.')
  })

  it('refuses once the cap is reached, and says the cap', () => {
    const result = applySelection(grid(), ['12A', '12B'], '12C', { maxSeats: 2 })
    expect(result.next).toEqual(['12A', '12B'])
    expect(result.rejection).toMatchObject({ reason: 'max-seats' })
    expect(result.rejection?.message).toBe('You can choose at most 2 seats.')
  })

  it('says "seat" rather than "seats" for a cap of one', () => {
    const result = applySelection(grid(), ['12A'], '12B', { maxSeats: 1 })
    expect(result.rejection?.message).toBe('You can choose at most 1 seat.')
  })

  it('still lets a capped selection be undone', () => {
    // The rule that traps a user in a selection they cannot undo is worse than
    // any it prevents, so deselection skips every check.
    expect(ids(applySelection(grid(), ['12A', '12B'], '12A', { maxSeats: 2 }))).toEqual(['12B'])
  })

  it('honours isSelectable and hands it the seat context', () => {
    const isSelectable = vi.fn().mockReturnValue(false)
    const result = applySelection(grid(), ['12A'], '12B', { isSelectable })
    expect(result.rejection).toMatchObject({ reason: 'not-selectable' })
    expect(isSelectable).toHaveBeenCalledWith(
      expect.objectContaining({ id: '12B' }),
      expect.objectContaining({ rowLabel: '12', columnLabel: 'B', selectedCount: 1 }),
    )
  })

  it('refuses a pick that is not next to the others', () => {
    const result = applySelection(grid(), ['12A'], '12C', { contiguous: true })
    expect(result.rejection).toMatchObject({ reason: 'not-contiguous' })
    expect(result.rejection?.message).toBe('12C is not next to your other seats.')
  })

  it('allows a contiguous extension on either side', () => {
    expect(ids(applySelection(grid(), ['12B'], '12A', { contiguous: true }))).toEqual([
      '12B',
      '12A',
    ])
    expect(ids(applySelection(grid(), ['12B'], '12C', { contiguous: true }))).toEqual([
      '12B',
      '12C',
    ])
  })

  it('refuses a pick that would strand a single seat', () => {
    const g = grid(parseLayout('12: ###'))
    const result = applySelection(g, [], '12B', { noOrphanSeats: true })
    expect(result.rejection).toMatchObject({ reason: 'orphan-seat' })
    expect(result.rejection?.message).toBe('Choosing 12B would leave a single empty seat.')
  })

  it('allows a pick at the end of a run', () => {
    const g = grid(parseLayout('12: ###'))
    expect(ids(applySelection(g, [], '12A', { noOrphanSeats: true }))).toEqual(['12A'])
  })

  it('does not let a pre-existing orphan block every pick in the row', () => {
    // Column C is already stranded by the sold seat. Choosing E must still work.
    const g = grid(parseLayout('12: #x###'))
    expect(ids(applySelection(g, [], '12E', { noOrphanSeats: true }))).toEqual(['12E'])
  })

  it('applies the rules in a fixed order — the cap outranks contiguity', () => {
    const result = applySelection(grid(), ['12A'], '12C', { maxSeats: 1, contiguous: true })
    expect(result.rejection?.reason).toBe('max-seats')
  })
})

describe('contextFor', () => {
  it('reports where a seat is and whether it is chosen', () => {
    const g = grid()
    const seat = g.byId.get('12E')
    expect(seat && contextFor(g, seat, ['12E'])).toEqual({
      sectionId: 'seats',
      sectionLabel: 'Seats',
      rowLabel: '12',
      rowIndex: 0,
      // Column 3 is the aisle, so `E` is the sixth cell — the letters skip it,
      // the cell indices do not.
      columnIndex: 5,
      columnLabel: 'E',
      selected: true,
      selectedCount: 1,
    })
  })
})

describe('findBestSeats', () => {
  it('returns nothing for a count that is not a positive integer', () => {
    expect(findBestSeats(ROW, 0)).toEqual([])
    expect(findBestSeats(ROW, -1)).toEqual([])
    expect(findBestSeats(ROW, 1.5)).toEqual([])
  })

  it('returns nothing when no run is long enough', () => {
    expect(findBestSeats(parseLayout('1: #x#'), 2)).toEqual([])
  })

  it('prefers the block nearest the centre of the row', () => {
    const seats = findBestSeats(parseLayout('1: #####'), 2)
    expect(seats.map((seat) => seat.id)).toEqual(['1B', '1C'])
  })

  it('prefers the earliest row', () => {
    const seats = findBestSeats(parseLayout('1: ##\n2: ##'), 2)
    expect(seats.map((seat) => seat.id)).toEqual(['1A', '1B'])
  })

  it('prefers the earliest section', () => {
    const seats = findBestSeats(parseLayout('Stalls\n1: ##\nCircle\n5: ##'), 2)
    expect(seats.map((seat) => seat.id)).toEqual(['stalls-1A', 'stalls-1B'])
  })

  it('never proposes a block across an aisle', () => {
    const seats = findBestSeats(parseLayout('1: ##_##'), 2)
    expect(seats.map((seat) => seat.id)).toEqual(['1A', '1B'])
  })

  it('skips a block that would leave an orphan when asked to', () => {
    // Any pair in a row of three strands the remaining seat.
    expect(findBestSeats(parseLayout('1: ###'), 2, { noOrphanSeats: true })).toEqual([])
    expect(
      findBestSeats(parseLayout('1: ####'), 2, { noOrphanSeats: true }).map((seat) => seat.id),
    ).toEqual(['1A', '1B'])
  })

  it('honours isSelectable', () => {
    const seats = findBestSeats(parseLayout('1: ####'), 2, {
      isSelectable: (seat) => seat.id !== '1B',
    })
    expect(seats.map((seat) => seat.id)).toEqual(['1C', '1D'])
  })

  it('finds a single seat', () => {
    expect(findBestSeats(parseLayout('1: #x#'), 1).map((seat) => seat.id)).toEqual(['1A'])
  })

  it('handles an empty layout', () => {
    expect(findBestSeats([], 2)).toEqual([])
  })
})
