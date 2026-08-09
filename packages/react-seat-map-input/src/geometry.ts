import type { Seat, SeatMapSection, SeatStatus } from './types'

/** A seat plus where it sits. The unit every other module works on. */
export interface GridSeat {
  seat: Seat
  status: SeatStatus
  sectionIndex: number
  rowIndex: number
  /** Cell index within the row — gaps included, so it matches `aria-colindex`. */
  columnIndex: number
  columnLabel: string
  rowLabel: string
}

export interface GridRow {
  label: string
  note?: string
  cells: (GridSeat | null)[]
}

export interface GridSection {
  id: string
  label: string
  /** One entry per cell column; `''` for a column that holds no seat anywhere. */
  columns: string[]
  rows: GridRow[]
  columnCount: number
}

export interface Grid {
  sections: GridSection[]
  byId: Map<string, GridSeat>
  /** Document order. Drives `findBestSeats` and the first/last lookups. */
  order: GridSeat[]
  /** Ids that appeared more than once. The first occurrence wins. */
  duplicateIds: string[]
}

/** A cell address. `column` is a cell index, so it counts gaps. */
export interface Position {
  section: number
  row: number
  column: number
}

export const statusOf = (seat: Seat): SeatStatus => seat.status ?? 'available'

/**
 * `A`…`Z`, then `AA`, `AB`… Spreadsheet-style rather than `A1`-style because
 * seat labels are read aloud letter by letter and `AA` survives that better
 * than a second alphabet.
 */
export function columnLabelAt(index: number): string {
  let label = ''
  let n = index
  do {
    label = String.fromCharCode(65 + (n % 26)) + label
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return label
}

/**
 * Normalizes the public, author-friendly shape into the indexed one navigation
 * and the rules engine need. Runs once per layout change, memoized by the hook.
 */
export function buildGrid(sections: SeatMapSection[]): Grid {
  const byId = new Map<string, GridSeat>()
  const order: GridSeat[] = []
  const duplicateIds: string[] = []

  const built = sections.map((section, sectionIndex) => {
    const columnCount = section.rows.reduce((widest, row) => Math.max(widest, row.cells.length), 0)

    // A column earns a label only if some row puts a seat in it, so an aisle
    // never consumes a letter and `12A` stays `12A` on both sides of the plane.
    const labels: string[] = []
    let nextAuto = 0
    for (let column = 0; column < columnCount; column++) {
      const holdsSeat = section.rows.some((row) => row.cells[column] != null)
      if (!holdsSeat) {
        labels.push('')
        continue
      }
      labels.push(section.columns?.[column] ?? columnLabelAt(nextAuto))
      nextAuto++
    }

    const rows: GridRow[] = section.rows.map((row, rowIndex) => ({
      label: row.label,
      ...(row.note === undefined ? {} : { note: row.note }),
      cells: Array.from({ length: columnCount }, (_, columnIndex) => {
        const seat = row.cells[columnIndex]
        if (seat == null) return null

        const gridSeat: GridSeat = {
          seat,
          status: statusOf(seat),
          sectionIndex,
          rowIndex,
          columnIndex,
          columnLabel: labels[columnIndex] ?? '',
          rowLabel: row.label,
        }
        // First occurrence wins. Keeping both would give one id two selection
        // states, which is worse than rendering a twin that mirrors the original.
        if (byId.has(seat.id)) duplicateIds.push(seat.id)
        else byId.set(seat.id, gridSeat)
        order.push(gridSeat)
        return gridSeat
      }),
    }))

    return { id: section.id, label: section.label, columns: labels, rows, columnCount }
  })

  return { sections: built, byId, order, duplicateIds }
}

/** The visible label a seat shows and speaks, e.g. `"12A"`. */
export const seatLabel = (gridSeat: GridSeat): string =>
  gridSeat.seat.label ?? `${gridSeat.rowLabel}${gridSeat.columnLabel}`

export function sectionAt(grid: Grid, index: number): GridSection | null {
  return grid.sections[index] ?? null
}

export function seatAt(grid: Grid, position: Position): GridSeat | null {
  return grid.sections[position.section]?.rows[position.row]?.cells[position.column] ?? null
}

export function positionOf(gridSeat: GridSeat): Position {
  return { section: gridSeat.sectionIndex, row: gridSeat.rowIndex, column: gridSeat.columnIndex }
}

/** First seat in document order within a section, or `null` for an empty one. */
export function firstSeatIn(section: GridSection, sectionIndex: number): Position | null {
  for (let row = 0; row < section.rows.length; row++) {
    for (let column = 0; column < section.columnCount; column++) {
      if (section.rows[row]?.cells[column]) return { section: sectionIndex, row, column }
    }
  }
  return null
}

export function lastSeatIn(section: GridSection, sectionIndex: number): Position | null {
  for (let row = section.rows.length - 1; row >= 0; row--) {
    for (let column = section.columnCount - 1; column >= 0; column--) {
      if (section.rows[row]?.cells[column]) return { section: sectionIndex, row, column }
    }
  }
  return null
}

/**
 * Same row, next cell that actually holds a seat. Aisles are stepped over
 * rather than landed on, and the walk stops at the row's edge — grids do not
 * wrap, and wrapping here would teleport a user across the cabin.
 */
export function moveHorizontal(grid: Grid, from: Position, step: 1 | -1): Position | null {
  const row = grid.sections[from.section]?.rows[from.row]
  if (!row) return null
  const width = grid.sections[from.section]?.columnCount ?? 0
  for (let column = from.column + step; column >= 0 && column < width; column += step) {
    if (row.cells[column]) return { ...from, column }
  }
  return null
}

/**
 * Same column, next row that holds a seat there. Staying in-column is what
 * makes repeated `ArrowDown` predictable; a row that is short or has a gap at
 * this column is skipped rather than nudging the user sideways.
 */
export function moveVertical(grid: Grid, from: Position, step: 1 | -1): Position | null {
  const section = grid.sections[from.section]
  if (!section) return null
  for (let row = from.row + step; row >= 0 && row < section.rows.length; row += step) {
    if (section.rows[row]?.cells[from.column]) return { ...from, row, column: from.column }
  }
  return null
}

export function rowEdge(grid: Grid, from: Position, edge: 'start' | 'end'): Position | null {
  const row = grid.sections[from.section]?.rows[from.row]
  if (!row) return null
  const width = grid.sections[from.section]?.columnCount ?? 0
  if (edge === 'start') {
    for (let column = 0; column < width; column++) {
      if (row.cells[column]) return { ...from, column }
    }
    return null
  }
  for (let column = width - 1; column >= 0; column--) {
    if (row.cells[column]) return { ...from, column }
  }
  return null
}

/** Exact column if it holds a seat, else the closest one, ties going left. */
export function nearestSeatInRow(
  section: GridSection,
  sectionIndex: number,
  rowIndex: number,
  preferredColumn: number,
): Position | null {
  const row = section.rows[rowIndex]
  if (!row) return null
  if (row.cells[preferredColumn]) {
    return { section: sectionIndex, row: rowIndex, column: preferredColumn }
  }
  for (let distance = 1; distance < section.columnCount; distance++) {
    const left = preferredColumn - distance
    if (left >= 0 && row.cells[left]) return { section: sectionIndex, row: rowIndex, column: left }
    const right = preferredColumn + distance
    if (right < section.columnCount && row.cells[right]) {
      return { section: sectionIndex, row: rowIndex, column: right }
    }
  }
  return null
}

/**
 * `PageUp` / `PageDown`. Aims `delta` rows away, then walks back toward the
 * origin until it finds a row with a seat — overshooting into an empty tail of
 * the section should still move you, not do nothing.
 */
export function pageMove(grid: Grid, from: Position, delta: number): Position | null {
  const section = grid.sections[from.section]
  if (!section || delta === 0) return null
  const step = delta > 0 ? 1 : -1
  const target = Math.min(Math.max(from.row + delta, 0), section.rows.length - 1)

  for (let row = target; step > 0 ? row >= from.row : row <= from.row; row -= step) {
    const found = nearestSeatInRow(section, from.section, row, from.column)
    if (found && !(found.row === from.row && found.column === from.column)) return found
  }
  return null
}
