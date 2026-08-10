import { UNIT_ORDER } from './duration'
import type { DurationUnit } from './duration'

/**
 * Unit suffixes taken from the platform.
 *
 * `Intl.NumberFormat` with `style: 'unit'` already knows that `en` writes
 * `30m`, `de` writes `30 Min.`, `fr` writes `30 min` and `zh` writes `30分钟`.
 * Asking it costs zero bytes, because every engine ships ICU anyway. The
 * alternative is a bundled table of abbreviations that is wrong about the
 * locales it forgot — which is what every duration package on npm does.
 *
 * `unitDisplay: 'narrow'` rather than `'short'`, because this is a compact
 * field: `short` gives English `hrs`/`mins`, which is wider than the number it
 * follows. CLDR decides what narrow means per locale, and for some — Japanese
 * among them — that is the Latin `h`/`m` rather than 時間/分. That is CLDR's
 * call about compact forms, not ours to override.
 *
 * Unlike the time field, the *order* does not come from `Intl`: a duration is
 * written largest-unit-first in every locale, and `Intl` has no formatter that
 * would tell us otherwise. Only the words are borrowed.
 */

/** One rendered piece: an editable unit, or the text that follows it. */
export type DurationPiece =
  { kind: 'segment'; type: DurationUnit } | { kind: 'literal'; text: string }

/** The `Intl` unit identifier for each of ours. They happen to match; be explicit. */
const INTL_UNIT: Readonly<Record<DurationUnit, string>> = {
  day: 'day',
  hour: 'hour',
  minute: 'minute',
  second: 'second',
}

/** Used when `Intl` is unavailable or gives us nothing usable. */
const FALLBACK_SUFFIX: Readonly<Record<DurationUnit, string>> = {
  day: 'd',
  hour: 'h',
  minute: 'm',
  second: 's',
}

/**
 * The suffix a locale writes after a number of this unit.
 *
 * Formatted against a plural number, because a locale that inflects would
 * otherwise hand back the singular and the field would read `2 minute`. The
 * digits are stripped out and what remains is the suffix, whitespace and all —
 * `zh` genuinely has no space before 分钟, and inserting one would be wrong.
 */
export function unitSuffix(unit: DurationUnit, locale?: string): string {
  try {
    const parts = new Intl.NumberFormat(locale, {
      style: 'unit',
      unit: INTL_UNIT[unit],
      unitDisplay: 'narrow',
    }).formatToParts(2)
    const suffix = parts
      .filter((part) => part.type !== 'integer' && part.type !== 'group')
      .map((part) => part.value)
      .join('')
      .trim()
    // A locale that puts the unit *before* the number, or reports nothing
    // usable, falls back rather than rendering an empty suffix that leaves two
    // adjacent spinbuttons visually indistinguishable. Every locale we test on
    // produces one, so this is the belt to that braces — excluded from coverage
    // rather than faked with a stub of `Intl`, which would only prove the stub
    // works.
    /* v8 ignore next */
    return suffix === '' ? FALLBACK_SUFFIX[unit] : suffix
  } catch {
    // `style: 'unit'` is ES2020 and an invalid locale tag throws RangeError. A
    // duration field that throws because someone passed "en_US" instead of
    // "en-US" is a worse outcome than one that falls back to `d`/`h`/`m`/`s`.
    return FALLBACK_SUFFIX[unit]
  }
}

/**
 * Coerce the `units` prop to something renderable: known units only, largest
 * first, no duplicates, never empty.
 *
 * Order is imposed rather than respected. `['minute', 'hour']` is not a field
 * that counts down; it is a typo, and rendering it would put a bounded minute
 * segment in front of an unbounded hour one — a field where `90` is refused in
 * the first box and accepted in the second.
 */
export function usableUnits(
  units: readonly DurationUnit[] | undefined,
  fallback: readonly DurationUnit[],
): DurationUnit[] {
  if (units === undefined) return [...fallback]
  const wanted = new Set(units.filter((unit) => UNIT_ORDER.includes(unit)))
  const ordered = UNIT_ORDER.filter((unit) => wanted.has(unit))
  return ordered.length === 0 ? [...fallback] : ordered
}

/** U+2009 THIN SPACE — the gap rendered between two unit groups. */
export const GAP = '\u2009'

/** The pieces of a duration field, in display order: each unit and its suffix. */
export function durationPieces(
  units: readonly DurationUnit[],
  locale: string | undefined,
): DurationPiece[] {
  const pieces: DurationPiece[] = []
  units.forEach((unit, index) => {
    pieces.push({ kind: 'segment', type: unit })
    pieces.push({ kind: 'literal', text: unitSuffix(unit, locale) })
    // A thin space between `1h` and `30m`, so the two do not read as one
    // number.
    if (index < units.length - 1) pieces.push({ kind: 'literal', text: GAP })
  })
  return pieces
}

/**
 * The locale's long name for a unit, for the segment's accessible name.
 *
 * `aria-label="Hours"` rather than `aria-label="h"`: the visible suffix is an
 * abbreviation chosen for width, and a screen reader announcing "h" tells the
 * user nothing about which box they are in.
 *
 * Formatted against 3, not 2. Arabic has a dual — `ساعتان` is specifically
 * *two* hours — and naming a segment after a quantity it does not hold is
 * worse than the plural. 3 lands in the generic plural in every locale that
 * distinguishes one.
 */
export function unitName(unit: DurationUnit, locale?: string): string | null {
  try {
    const parts = new Intl.NumberFormat(locale, {
      style: 'unit',
      unit: INTL_UNIT[unit],
      unitDisplay: 'long',
    }).formatToParts(3)
    const name = parts
      .filter((part) => part.type !== 'integer' && part.type !== 'group')
      .map((part) => part.value)
      .join('')
      .trim()
    // As above: no locale we test on reports an empty unit name.
    /* v8 ignore next */
    return name === '' ? null : name
  } catch {
    return null
  }
}
