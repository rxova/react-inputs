import { describe, expect, it } from 'vitest'
import {
  buildGrid,
  columnLabelAt,
  firstSeatIn,
  lastSeatIn,
  moveHorizontal,
  moveVertical,
  nearestSeatInRow,
  pageMove,
  positionOf,
  rowEdge,
  seatAt,
  seatLabel,
  sectionAt,
  statusOf,
} from '../geometry'
import type { Grid } from '../geometry'
import { parseLayout } from '../layout'
import type { SeatMapSection } from '../types'

/**
 * The navigation model is the whole reason this component needs a keydown
 * handler at all, so it is tested as plain data here rather than through a
 * rendered grid — a wrong neighbour is a bug whether or not a browser is
 * involved, and this suite pins it in milliseconds.
 */

const CABIN = parseLayout(`
  10: ##_##
  11: ##_##
  12: ##_##
`)

const grid = (sections: SeatMapSection[] = CABIN): Grid => buildGrid(sections)

const at = (g: Grid, section: number, row: number, column: number) =>
  seatAt(g, { section, row, column })?.seat.id ?? null

describe('columnLabelAt', () => {
  it('walks the alphabet', () => {
    expect(columnLabelAt(0)).toBe('A')
    expect(columnLabelAt(25)).toBe('Z')
  })

  it('rolls over to two letters rather than starting a second alphabet', () => {
    expect(columnLabelAt(26)).toBe('AA')
    expect(columnLabelAt(27)).toBe('AB')
    expect(columnLabelAt(51)).toBe('AZ')
    expect(columnLabelAt(52)).toBe('BA')
  })
})

describe('statusOf', () => {
  it('defaults to available', () => {
    expect(statusOf({ id: '1A' })).toBe('available')
  })

  it('passes an explicit status through', () => {
    expect(statusOf({ id: '1A', status: 'held' })).toBe('held')
  })
})

describe('buildGrid', () => {
  it('indexes every seat by id', () => {
    const g = grid()
    expect(g.byId.size).toBe(12)
    expect(g.order).toHaveLength(12)
    expect(g.byId.get('10A')?.columnIndex).toBe(0)
    expect(g.byId.get('10C')?.columnIndex).toBe(3)
  })

  it('keeps gaps as null cells so columns cannot drift', () => {
    const g = grid()
    expect(g.sections[0]?.rows[0]?.cells[2]).toBeNull()
    expect(g.sections[0]?.columnCount).toBe(5)
  })

  it('skips aisle columns when auto-labelling', () => {
    expect(grid().sections[0]?.columns).toEqual(['A', 'B', '', 'C', 'D'])
  })

  it('honours author-supplied column labels', () => {
    const g = grid([
      {
        id: 's',
        label: 'S',
        columns: ['L', 'M', '', 'N'],
        rows: [{ label: '1', cells: [{ id: 'x' }, { id: 'y' }, null, { id: 'z' }] }],
      },
    ])
    expect(g.sections[0]?.columns).toEqual(['L', 'M', '', 'N'])
  })

  it('pads short rows to the widest row in the section', () => {
    const g = grid([
      {
        id: 's',
        label: 'S',
        rows: [
          { label: '1', cells: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] },
          { label: '2', cells: [{ id: 'd' }] },
        ],
      },
    ])
    expect(g.sections[0]?.rows[1]?.cells).toHaveLength(3)
    expect(g.sections[0]?.rows[1]?.cells[2]).toBeNull()
  })

  it('records duplicate ids and lets the first occurrence win', () => {
    const g = grid([
      {
        id: 's',
        label: 'S',
        rows: [
          { label: '1', cells: [{ id: 'dup', category: 'first' }] },
          { label: '2', cells: [{ id: 'dup', category: 'second' }] },
        ],
      },
    ])
    expect(g.duplicateIds).toEqual(['dup'])
    expect(g.byId.get('dup')?.seat.category).toBe('first')
    // The twin still renders — dropping it would leave a hole in the diagram.
    expect(g.order).toHaveLength(2)
  })

  it('carries the row note onto the row', () => {
    const g = grid([
      { id: 's', label: 'S', rows: [{ label: '1', note: 'exit row', cells: [{ id: 'a' }] }] },
    ])
    expect(g.sections[0]?.rows[0]?.note).toBe('exit row')
  })

  it('omits the note key entirely when there is none', () => {
    const g = grid()
    expect(g.sections[0]?.rows[0] && 'note' in g.sections[0].rows[0]).toBe(false)
  })

  it('handles a section with no rows', () => {
    const g = grid([{ id: 'empty', label: 'Empty', rows: [] }])
    expect(g.sections[0]?.columnCount).toBe(0)
    expect(g.order).toHaveLength(0)
  })
})

describe('seatLabel', () => {
  it('composes the row and column labels', () => {
    const seat = grid().byId.get('11B')
    expect(seat && seatLabel(seat)).toBe('11B')
  })

  it('prefers an explicit label', () => {
    const g = grid([
      { id: 's', label: 'S', rows: [{ label: '1', cells: [{ id: 'x', label: 'Box 4' }] }] },
    ])
    const seat = g.byId.get('x')
    expect(seat && seatLabel(seat)).toBe('Box 4')
  })
})

describe('lookups', () => {
  it('resolves a section by index and reports a miss as null', () => {
    const g = grid()
    expect(sectionAt(g, 0)?.id).toBe('seats')
    expect(sectionAt(g, 9)).toBeNull()
  })

  it('resolves a seat by position and reports a gap as null', () => {
    const g = grid()
    expect(at(g, 0, 0, 0)).toBe('10A')
    expect(at(g, 0, 0, 2)).toBeNull()
    expect(at(g, 0, 9, 0)).toBeNull()
  })

  it('round-trips a seat through positionOf', () => {
    const g = grid()
    const seat = g.byId.get('12D')
    expect(seat && positionOf(seat)).toEqual({ section: 0, row: 2, column: 4 })
  })

  it('finds the first and last seat in a section', () => {
    const g = grid()
    const section = g.sections[0]
    expect(section && firstSeatIn(section, 0)).toEqual({ section: 0, row: 0, column: 0 })
    expect(section && lastSeatIn(section, 0)).toEqual({ section: 0, row: 2, column: 4 })
  })

  it('returns null for the edges of an empty section', () => {
    const g = grid([{ id: 'empty', label: 'Empty', rows: [{ label: '1', cells: [null] }] }])
    const section = g.sections[0]
    expect(section && firstSeatIn(section, 0)).toBeNull()
    expect(section && lastSeatIn(section, 0)).toBeNull()
  })
})

describe('moveHorizontal', () => {
  it('steps over the aisle rather than landing in it', () => {
    const g = grid()
    const next = moveHorizontal(g, { section: 0, row: 0, column: 1 }, 1)
    expect(next).toEqual({ section: 0, row: 0, column: 3 })
  })

  it('clamps at the row edge instead of wrapping', () => {
    const g = grid()
    expect(moveHorizontal(g, { section: 0, row: 0, column: 4 }, 1)).toBeNull()
    expect(moveHorizontal(g, { section: 0, row: 0, column: 0 }, -1)).toBeNull()
  })

  it('returns null for a row that does not exist', () => {
    expect(moveHorizontal(grid(), { section: 0, row: 9, column: 0 }, 1)).toBeNull()
  })
})

describe('moveVertical', () => {
  it('stays in the same column', () => {
    const g = grid()
    expect(moveVertical(g, { section: 0, row: 0, column: 3 }, 1)).toEqual({
      section: 0,
      row: 1,
      column: 3,
    })
  })

  it('skips a row that has no seat in this column', () => {
    const g = grid(
      parseLayout(`
      1: ##
      2: #_
      3: ##
    `),
    )
    expect(moveVertical(g, { section: 0, row: 0, column: 1 }, 1)).toEqual({
      section: 0,
      row: 2,
      column: 1,
    })
  })

  it('clamps at the first and last row', () => {
    const g = grid()
    expect(moveVertical(g, { section: 0, row: 0, column: 0 }, -1)).toBeNull()
    expect(moveVertical(g, { section: 0, row: 2, column: 0 }, 1)).toBeNull()
  })

  it('returns null for a section that does not exist', () => {
    expect(moveVertical(grid(), { section: 5, row: 0, column: 0 }, 1)).toBeNull()
  })
})

describe('rowEdge', () => {
  it('finds the first and last seat in the row', () => {
    const g = grid()
    expect(rowEdge(g, { section: 0, row: 1, column: 3 }, 'start')).toEqual({
      section: 0,
      row: 1,
      column: 0,
    })
    expect(rowEdge(g, { section: 0, row: 1, column: 0 }, 'end')).toEqual({
      section: 0,
      row: 1,
      column: 4,
    })
  })

  it('returns null for a row of nothing but gaps', () => {
    const g = grid([{ id: 's', label: 'S', rows: [{ label: '1', cells: [null, null] }] }])
    expect(rowEdge(g, { section: 0, row: 0, column: 0 }, 'start')).toBeNull()
    expect(rowEdge(g, { section: 0, row: 0, column: 0 }, 'end')).toBeNull()
  })

  it('returns null for a row that does not exist', () => {
    expect(rowEdge(grid(), { section: 0, row: 9, column: 0 }, 'start')).toBeNull()
  })
})

describe('nearestSeatInRow', () => {
  it('prefers the exact column', () => {
    const g = grid()
    const section = g.sections[0]
    expect(section && nearestSeatInRow(section, 0, 1, 3)).toEqual({
      section: 0,
      row: 1,
      column: 3,
    })
  })

  it('breaks a tie to the left, so repeated paging does not drift right', () => {
    const g = grid()
    const section = g.sections[0]
    // Column 2 is the aisle; columns 1 and 3 are both one step away.
    expect(section && nearestSeatInRow(section, 0, 1, 2)).toEqual({
      section: 0,
      row: 1,
      column: 1,
    })
  })

  it('reaches across several empty columns', () => {
    const g = grid([
      { id: 's', label: 'S', rows: [{ label: '1', cells: [null, null, null, { id: 'z' }] }] },
    ])
    const section = g.sections[0]
    expect(section && nearestSeatInRow(section, 0, 0, 0)).toEqual({
      section: 0,
      row: 0,
      column: 3,
    })
  })

  it('returns null for a row with no seats, and for a missing row', () => {
    const g = grid([{ id: 's', label: 'S', rows: [{ label: '1', cells: [null] }] }])
    const section = g.sections[0]
    expect(section && nearestSeatInRow(section, 0, 0, 0)).toBeNull()
    expect(section && nearestSeatInRow(section, 0, 4, 0)).toBeNull()
  })
})

describe('pageMove', () => {
  const tall = grid(
    parseLayout(`
    1: ##
    2: ##
    3: ##
    4: ##
    5: ##
    6: ##
    7: ##
  `),
  )

  it('jumps a page down', () => {
    expect(pageMove(tall, { section: 0, row: 0, column: 0 }, 5)).toEqual({
      section: 0,
      row: 5,
      column: 0,
    })
  })

  it('clamps to the last row rather than overshooting off the end', () => {
    expect(pageMove(tall, { section: 0, row: 4, column: 1 }, 5)).toEqual({
      section: 0,
      row: 6,
      column: 1,
    })
  })

  it('walks back toward the origin when the target row has no seats', () => {
    const g = grid(
      parseLayout(`
      1: ##
      2: ##
      3: ##
      4: __
    `),
    )
    expect(pageMove(g, { section: 0, row: 0, column: 0 }, 3)).toEqual({
      section: 0,
      row: 2,
      column: 0,
    })
  })

  it('returns null when it cannot move at all', () => {
    const g = grid(parseLayout('1: ##'))
    expect(pageMove(g, { section: 0, row: 0, column: 0 }, 5)).toBeNull()
    expect(pageMove(g, { section: 0, row: 0, column: 0 }, 0)).toBeNull()
    expect(pageMove(g, { section: 4, row: 0, column: 0 }, 5)).toBeNull()
  })

  it('jumps a page up', () => {
    expect(pageMove(tall, { section: 0, row: 6, column: 0 }, -5)).toEqual({
      section: 0,
      row: 1,
      column: 0,
    })
  })
})
