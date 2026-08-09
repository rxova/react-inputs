import { buildGrid, seatLabel } from './geometry'
import type { Grid, GridRow, GridSeat } from './geometry'
import type {
  Seat,
  SeatContext,
  SeatMapRejection,
  SeatMapRejectionReason,
  SeatMapSection,
} from './types'

export interface SelectionRules {
  maxSeats?: number
  contiguous?: boolean
  noOrphanSeats?: boolean
  isSelectable?: (seat: Seat, context: SeatContext) => boolean
}

export interface SelectionResult {
  next: string[]
  rejection?: SeatMapRejection
}

export function contextFor(
  grid: Grid,
  gridSeat: GridSeat,
  selected: readonly string[],
): SeatContext {
  const section = grid.sections[gridSeat.sectionIndex]
  return {
    sectionId: section?.id ?? '',
    sectionLabel: section?.label ?? '',
    rowLabel: gridSeat.rowLabel,
    rowIndex: gridSeat.rowIndex,
    columnIndex: gridSeat.columnIndex,
    columnLabel: gridSeat.columnLabel,
    selected: selected.includes(gridSeat.seat.id),
    selectedCount: selected.length,
  }
}

/**
 * Consecutive cell indices in one row of one section. A gap counts as a break:
 * two seats either side of an aisle are next to each other on the diagram and
 * nowhere near each other in the cabin.
 */
export function isContiguous(grid: Grid, ids: readonly string[]): boolean {
  const seats = ids.flatMap((id) => {
    const found = grid.byId.get(id)
    return found ? [found] : []
  })
  const first = seats[0]
  if (first === undefined || seats.length === 1) return true
  if (!seats.every((s) => s.sectionIndex === first.sectionIndex && s.rowIndex === first.rowIndex)) {
    return false
  }
  const columns = seats.map((s) => s.columnIndex).sort((a, b) => a - b)
  return columns.every((column, index) => index === 0 || column === (columns[index - 1] ?? 0) + 1)
}

/**
 * Runs of exactly one still-buyable seat, walled in by aisles, row ends, or
 * seats that are gone. A booking flow that leaves these behind sells the row
 * one seat short, which is why real venues refuse the pick that creates one.
 */
export function countOrphans(row: GridRow, selected: ReadonlySet<string>): number {
  let orphans = 0
  let run = 0
  for (const cell of row.cells) {
    const free = cell !== null && cell.status === 'available' && !selected.has(cell.seat.id)
    if (free) {
      run++
      continue
    }
    if (run === 1) orphans++
    run = 0
  }
  if (run === 1) orphans++
  return orphans
}

function unavailableMessage(label: string, status: GridSeat['status']): string {
  if (status === 'occupied') return `${label} is already taken.`
  if (status === 'held') return `${label} is on hold.`
  return `${label} is not available.`
}

function reject(reason: SeatMapRejectionReason, seat: Seat, message: string): SeatMapRejection {
  return { reason, seat, message }
}

/**
 * The whole rule engine, as one pure function over plain data. Deselecting is
 * never refused — a rule that traps a user in a selection they cannot undo is a
 * worse bug than any it prevents.
 */
export function applySelection(
  grid: Grid,
  current: readonly string[],
  seatId: string,
  rules: SelectionRules = {},
): SelectionResult {
  const gridSeat = grid.byId.get(seatId)
  if (!gridSeat) return { next: [...current] }

  const label = seatLabel(gridSeat)

  if (current.includes(seatId)) {
    return { next: current.filter((id) => id !== seatId) }
  }

  if (gridSeat.status !== 'available') {
    return {
      next: [...current],
      rejection: reject('unavailable', gridSeat.seat, unavailableMessage(label, gridSeat.status)),
    }
  }

  const { maxSeats, contiguous, noOrphanSeats, isSelectable } = rules

  if (maxSeats !== undefined && current.length >= maxSeats) {
    return {
      next: [...current],
      rejection: reject(
        'max-seats',
        gridSeat.seat,
        `You can choose at most ${String(maxSeats)} ${maxSeats === 1 ? 'seat' : 'seats'}.`,
      ),
    }
  }

  if (isSelectable && !isSelectable(gridSeat.seat, contextFor(grid, gridSeat, current))) {
    return {
      next: [...current],
      rejection: reject('not-selectable', gridSeat.seat, `${label} cannot be chosen.`),
    }
  }

  const next = [...current, seatId]

  if (contiguous && !isContiguous(grid, next)) {
    return {
      next: [...current],
      rejection: reject(
        'not-contiguous',
        gridSeat.seat,
        `${label} is not next to your other seats.`,
      ),
    }
  }

  if (noOrphanSeats) {
    const row = grid.sections[gridSeat.sectionIndex]?.rows[gridSeat.rowIndex]
    // Only this row's free segments can have changed, so only this row is worth
    // recounting. Comparing before/after keeps a pre-existing orphan from
    // blocking every pick in the row.
    if (row && countOrphans(row, new Set(next)) > countOrphans(row, new Set(current))) {
      return {
        next: [...current],
        rejection: reject(
          'orphan-seat',
          gridSeat.seat,
          `Choosing ${label} would leave a single empty seat.`,
        ),
      }
    }
  }

  return { next }
}

export interface FindBestSeatsOptions {
  /** Skip blocks whose booking would strand a lone empty seat. */
  noOrphanSeats?: boolean
  /** Same predicate the component takes; every seat in a block must pass it. */
  isSelectable?: (seat: Seat, context: SeatContext) => boolean
}

/**
 * The best run of `count` adjacent free seats, or `[]` when the map has none.
 *
 * "Best" is deliberately spelled out rather than tuned: earliest section, then
 * earliest row, then the block closest to the centre of its row. A venue with a
 * different idea of best can rank `findBestSeats` candidates itself — the point
 * of publishing it is that the adjacency scan is the hard part, not the taste.
 */
export function findBestSeats(
  sections: SeatMapSection[],
  count: number,
  options: FindBestSeatsOptions = {},
): Seat[] {
  if (!Number.isInteger(count) || count < 1) return []

  const grid = buildGrid(sections)
  let bestSeats: Seat[] = []
  let bestScore: BlockScore | null = null

  // `entries()` rather than an index loop: it keeps `section` and `row`
  // non-nullable under `noUncheckedIndexedAccess`, so there is no unreachable
  // guard here pretending to be a real branch.
  for (const [sectionIndex, section] of grid.sections.entries()) {
    const centre = (section.columnCount - 1) / 2

    for (const [rowIndex, row] of section.rows.entries()) {
      for (let start = 0; start + count <= section.columnCount; start++) {
        const block: GridSeat[] = []
        for (let offset = 0; offset < count; offset++) {
          const cell = row.cells[start + offset]
          // Optional chain covers the gap: a `null` cell is not available either.
          if (cell?.status !== 'available') break
          if (options.isSelectable?.(cell.seat, contextFor(grid, cell, [])) === false) break
          block.push(cell)
        }
        if (block.length < count) continue

        if (options.noOrphanSeats) {
          const taken = new Set(block.map((cell) => cell.seat.id))
          if (countOrphans(row, taken) > countOrphans(row, new Set())) continue
        }

        const score: BlockScore = {
          section: sectionIndex,
          row: rowIndex,
          offCentre: Math.abs(start + (count - 1) / 2 - centre),
        }
        if (bestScore === null || isBetter(score, bestScore)) {
          bestSeats = block.map((cell) => cell.seat)
          bestScore = score
        }
      }
    }
  }

  return bestSeats
}

interface BlockScore {
  section: number
  row: number
  offCentre: number
}

function isBetter(a: BlockScore, b: BlockScore): boolean {
  if (a.section !== b.section) return a.section < b.section
  if (a.row !== b.row) return a.row < b.row
  return a.offCentre < b.offCentre
}
