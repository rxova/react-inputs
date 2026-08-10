import { compareUnitSize, dimensionOf, isCarryPair, isMeasurementUnit, isSigned } from './units'
import type { Dimension, MeasurementUnit } from './units'

/**
 * Unit words taken from the platform.
 *
 * `Intl.NumberFormat` with `style: 'unit'` already knows that `en` writes
 * `5 ft`, `fr` writes `5 pi` and `de` writes `5 ft`. Asking it costs zero bytes,
 * because every engine ships ICU anyway. The alternative is a bundled table of
 * abbreviations that is wrong about the locales it forgot.
 *
 * Unlike the time field, the *order* does not come from `Intl`: a measurement is
 * written largest-unit-first in every locale, and `Intl` has no formatter that
 * would say otherwise. Only the words are borrowed.
 */

/** One rendered piece: an editable unit, or the text that follows it. */
export type MeasurementPiece =
  { kind: 'segment'; type: MeasurementUnit } | { kind: 'literal'; text: string }

/**
 * The gap between one unit and the next.
 *
 * U+2009 THIN SPACE, written as an escape rather than pasted. Pasted literally
 * it is indistinguishable from an ordinary space in every editor and diff, so a
 * test comparing the two would pass or fail for reasons nobody could see.
 */
export const GAP = '\u2009'

/**
 * Format a unit through `Intl`, falling back to the runtime's own locale.
 *
 * An invalid BCP 47 tag makes the constructor throw, and a measurement field
 * that blanks the page because someone wrote `en_US` instead of `en-US` is a
 * worse outcome than one that renders in the default locale.
 */
function unitParts(
  unit: MeasurementUnit,
  locale: string | undefined,
  unitDisplay: 'short' | 'long',
): string | null {
  const build = (tag: string | undefined): string =>
    new Intl.NumberFormat(tag, { style: 'unit', unit, unitDisplay })
      // Formatted against 3, not 1 or 2. A locale that inflects would hand back
      // the singular for 1, and Arabic has a *dual* — `قدمان` is specifically
      // two feet — so naming a segment after a quantity it does not hold is
      // worse than the plural. 3 lands in the generic plural everywhere.
      .formatToParts(3)
      .filter((part) => part.type !== 'integer' && part.type !== 'group')
      .map((part) => part.value)
      .join('')

  try {
    return build(locale)
  } catch {
    try {
      return build(undefined)
    } catch {
      // `style: 'unit'` is ES2020 and every unit here is in
      // `Intl.supportedValuesOf('unit')`, so reaching this needs an engine with
      // no unit formatting at all — which is exactly what the fallback is for.
      return null
    }
  }
}

/**
 * The suffix a locale writes after a number of this unit.
 *
 * `unitDisplay: 'short'`, not `'narrow'` — a deliberate departure from the
 * duration field, made by looking at what ICU actually returns rather than at
 * which name sounds smaller. Two narrow forms are unusable here:
 *
 * - `pound` narrow in `en` is `#`, so eleven pounds renders as `11#`.
 * - `fahrenheit` narrow in `en` is a bare `°` — exactly the character Celsius
 *   also uses, in a field whose entire purpose is converting between the two.
 *
 * Short gives `lb` and `°F`. The whitespace ICU puts between the number and the
 * unit is kept rather than trimmed, because that spacing is itself locale data:
 * `en` writes `5 ft` with a space and `3°C` without one.
 */
export function unitSuffix(unit: MeasurementUnit, locale?: string): string {
  const suffix = unitParts(unit, locale, 'short')
  // A locale that puts the unit *before* the number, or reports nothing usable,
  // falls back to the identifier rather than rendering an empty suffix that
  // would leave two adjacent spinbuttons visually indistinguishable.
  return suffix === null || suffix.trim() === '' ? ` ${unit}` : suffix
}

/**
 * The locale's long name for a unit, for the segment's accessible name.
 *
 * `aria-label="feet"` rather than `aria-label="ft"`: the visible suffix is an
 * abbreviation chosen for width, and a screen reader announcing "ft" tells the
 * user nothing about which box they are in.
 */
export function unitName(unit: MeasurementUnit, locale?: string): string | null {
  const name = unitParts(unit, locale, 'long')?.trim()
  return name === undefined || name === '' ? null : name
}

/**
 * Coerce the `units` prop to something renderable.
 *
 * Four repairs, each turning a field that could not work into one that can:
 *
 * 1. **Unknown and refused units are dropped.** `'furlong'` is not an `Intl`
 *    unit; `'minute'` is, and belongs to `@rxova/react-duration-input`.
 * 2. **Only one dimension survives.** `['meter', 'pound']` is not a field, it
 *    is two — the first unit's dimension wins and the rest go.
 * 3. **Largest first, deduped.** `['inch', 'foot']` is a typo, not a field that
 *    counts down: as written it would put a bounded inches segment in front of
 *    an unbounded feet one, so `14` would be refused in the first box and
 *    accepted in the second.
 * 4. **Every adjacent pair must divide.** A foot is exactly twelve inches, so
 *    the inches segment runs 0–11 and a twelfth carries upward. A metre is
 *    39.37 inches, so an inches segment beside it would have no ceiling to
 *    carry at — the pair collapses to a single unit rather than rendering a
 *    segment whose overflow rule cannot exist.
 *
 * Temperature is single-unit on top of all that: `3 °C 20 °F` is not a
 * temperature, it is two of them.
 */
export function usableUnits(
  units: readonly string[] | undefined,
  fallback: readonly MeasurementUnit[],
): MeasurementUnit[] {
  if (units === undefined) return [...fallback]

  const known = units.filter(isMeasurementUnit)
  const first = known[0]
  if (first === undefined) return [...fallback]

  const dimension = dimensionOf(first)
  /* v8 ignore next */
  if (dimension === null) return [...fallback]

  // Before the sort, not after. "Largest" is meaningless between two scales
  // with different zeroes — a degree Celsius is 1.8 degrees Fahrenheit, which
  // says nothing about which is the bigger *unit* — so sorting first would turn
  // `['fahrenheit', 'celsius']` into a Celsius field and change what every
  // number in it means.
  if (isSigned(dimension)) return [first]

  const ordered = [...new Set(known.filter((unit) => dimensionOf(unit) === dimension))].sort(
    compareUnitSize,
  )

  const kept: MeasurementUnit[] = []
  for (const unit of ordered) {
    const previous = kept[kept.length - 1]
    if (previous === undefined || isCarryPair(previous, unit)) kept.push(unit)
  }
  return kept
}

/** The dimension a repaired set of units belongs to. */
export function dimensionOfUnits(units: readonly MeasurementUnit[]): Dimension | null {
  const first = units[0]
  return first === undefined ? null : dimensionOf(first)
}

/** The pieces of a measurement field, in display order: each unit and its suffix. */
export function measurementPieces(
  units: readonly MeasurementUnit[],
  locale: string | undefined,
): MeasurementPiece[] {
  const pieces: MeasurementPiece[] = []
  units.forEach((unit, index) => {
    pieces.push({ kind: 'segment', type: unit })
    pieces.push({ kind: 'literal', text: unitSuffix(unit, locale) })
    // A thin gap between `5 ft` and `11 in`, so the two do not read as one
    // number.
    if (index < units.length - 1) pieces.push({ kind: 'literal', text: GAP })
  })
  return pieces
}
