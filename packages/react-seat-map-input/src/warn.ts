import type { Grid } from './geometry'
import type { SeatMapWarning } from './types'

/**
 * Development-only diagnostics.
 *
 * Every function here is reached exclusively from the
 * `NODE_ENV !== 'production'` branch in `useSeatMap`, so a production bundler
 * drops this whole module. Nothing here changes behaviour: the grid has already
 * been built and the value already filtered by the time these run, so a warning
 * can only ever describe a decision that was taken, never take one.
 */

/** A layout with no seats at all is almost always a data-loading bug. */
export function inspectLayout(grid: Grid): SeatMapWarning[] {
  const warnings: SeatMapWarning[] = []

  if (grid.order.length === 0) {
    warnings.push({
      code: 'no-layout',
      message: 'No seats to render. Pass `sections` or `rows`; an empty map renders an empty grid.',
    })
  }

  // Deduped, because a layout generated in a loop tends to repeat one bad id
  // dozens of times and a hundred identical console lines helps nobody.
  for (const seatId of new Set(grid.duplicateIds)) {
    warnings.push({
      code: 'duplicate-seat-id',
      seatId,
      message: `Seat id "${seatId}" appears more than once. Only the first is selectable; the rest mirror it.`,
    })
  }

  return warnings
}

/** Ids in `value`/`defaultValue` that no seat in the layout answers to. */
export function inspectValue(grid: Grid, ids: readonly string[]): SeatMapWarning[] {
  return ids
    .filter((id) => !grid.byId.has(id))
    .map((seatId) => ({
      code: 'unknown-seat-id' as const,
      seatId,
      message: `"${seatId}" is not a seat in this map; dropping it from the selection.`,
    }))
}

export function inspectLimits(maxSeats?: number, minSeats?: number): SeatMapWarning[] {
  const warnings: SeatMapWarning[] = []

  if (maxSeats !== undefined && (!Number.isInteger(maxSeats) || maxSeats < 1)) {
    warnings.push({
      code: 'max-seats-invalid',
      message: `\`maxSeats\` must be a positive integer; received ${String(maxSeats)}. Ignoring it.`,
    })
  }

  if (
    minSeats !== undefined &&
    maxSeats !== undefined &&
    Number.isInteger(maxSeats) &&
    maxSeats >= 1 &&
    minSeats > maxSeats
  ) {
    warnings.push({
      code: 'min-above-max',
      message: `\`minSeats\` (${String(minSeats)}) is above \`maxSeats\` (${String(maxSeats)}); the field can never be valid.`,
    })
  }

  return warnings
}
