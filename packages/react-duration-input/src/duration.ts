/**
 * Duration arithmetic on plain numbers and ISO 8601 duration strings.
 *
 * Same reasoning as the date field's `date.ts` and the time field's `time.ts`,
 * pushed one step further. A duration is not a point in time and not a `Date`:
 * `new Date(90 * 60 * 1000)` is 1 January 1970, 01:30 UTC, which is a *moment*
 * that shifts with the timezone. "An hour and a half" does not.
 *
 * So this module never constructs one. The canonical value is an ISO 8601
 * duration — `PT1H30M` — which is the interchange format the rest of the world
 * already agreed on.
 *
 * The one place this differs from its siblings, and it is worth being loud
 * about: an ISO duration does **not** sort lexicographically. `'PT10M' < 'PT2H'`
 * is true as strings and false as durations, because the format is neither
 * fixed-width nor big-endian. The date and time fields can compare with `<`;
 * this one has to go through seconds, so {@link compareDurations} exists and is
 * the only correct way to order two of these.
 */

/** The four editable units, largest first. */
export type DurationUnit = 'day' | 'hour' | 'minute' | 'second'

/** Every unit, in the order a duration is written and carried. */
export const UNIT_ORDER: readonly DurationUnit[] = ['day', 'hour', 'minute', 'second']

/** Seconds in one of each unit. The reason months and years are not here. */
export const UNIT_SECONDS: Readonly<Record<DurationUnit, number>> = {
  day: 86_400,
  hour: 3_600,
  minute: 60,
  second: 1,
}

/** The ISO 8601 designator for each unit. `M` is minutes only inside `T`. */
const UNIT_LETTER: Readonly<Record<DurationUnit, string>> = {
  day: 'D',
  hour: 'H',
  minute: 'M',
  second: 'S',
}

/** A partially-entered duration. `null` means "that unit is still empty". */
export type DurationParts = Readonly<Record<DurationUnit, number | null>>

export const EMPTY_PARTS: DurationParts = {
  day: null,
  hour: null,
  minute: null,
  second: null,
}

/**
 * Inclusive bounds for one unit of a field.
 *
 * The leading unit is deliberately unbounded: in a field showing only minutes,
 * `90` is a real 90-minute duration and refusing it would be refusing the most
 * common thing anyone types. Every unit after the leading one is bounded by the
 * unit above it — 90 minutes is not a legal *minutes component* once hours are
 * on screen, because it means the same thing as `1h 30m`.
 *
 * `Infinity` rather than a large number, so `aria-valuemax` can be omitted
 * instead of lying about a ceiling that does not exist.
 */
export function unitRange(
  unit: DurationUnit,
  units: readonly DurationUnit[],
): { min: number; max: number } {
  if (units[0] === unit) return { min: 0, max: Infinity }
  if (unit === 'hour') return { min: 0, max: 23 }
  return { min: 0, max: 59 }
}

/**
 * How many digits a unit accepts before it is full and focus moves on.
 *
 * Two everywhere, except in a single-unit field, where it is three. That
 * exception is not cosmetic: a minutes-only field has nothing to advance *to*,
 * so a two-digit ceiling would make `180` unreachable — the third keystroke
 * would start a new number in the same box and leave `0`.
 *
 * Width is the only thing that ends a number here. The time field also advances
 * early when a further digit could not stay inside the segment's range, which a
 * duration cannot do: the ranges are what typing is allowed to exceed.
 */
export function unitWidth(unit: DurationUnit, units: readonly DurationUnit[]): number {
  return units[0] === unit && units.length === 1 ? 3 : 2
}

/** Zero-pad to `width` digits. Never truncates a number wider than the pad. */
export function pad(value: number, width: number): string {
  return String(value).padStart(width, '0')
}

/** Every unit the field shows has been filled in. */
export function isComplete(parts: DurationParts, units: readonly DurationUnit[]): boolean {
  return units.every((unit) => parts[unit] !== null)
}

/** Whether any unit at all has been filled in. */
export function isEmpty(parts: DurationParts): boolean {
  return UNIT_ORDER.every((unit) => parts[unit] === null)
}

/** Total seconds for a set of parts. Empty units count as zero. */
export function durationToSeconds(parts: DurationParts): number {
  let total = 0
  for (const unit of UNIT_ORDER) {
    const value = parts[unit]
    if (value !== null) total += value * UNIT_SECONDS[unit]
  }
  return total
}

/**
 * Split a whole number of seconds across the units a field shows.
 *
 * Anything smaller than the smallest displayed unit is truncated, not rounded:
 * `PT90S` in an `h:m` field is `0h 1m`. That loss is real, so it is not left
 * implicit — {@link fitsUnits} reports it and the hook warns, rather than
 * letting a 90-second value quietly become a minute.
 */
export function secondsToDuration(
  totalSeconds: number,
  units: readonly DurationUnit[],
): DurationParts {
  const parts: Record<DurationUnit, number | null> = { ...EMPTY_PARTS }
  let rest = Math.max(0, Math.floor(totalSeconds))
  for (const unit of UNIT_ORDER) {
    if (!units.includes(unit)) continue
    const size = UNIT_SECONDS[unit]
    parts[unit] = Math.floor(rest / size)
    rest -= parts[unit] * size
  }
  return parts
}

/** Whether a duration in seconds survives being shown in `units` without loss. */
export function fitsUnits(totalSeconds: number, units: readonly DurationUnit[]): boolean {
  return durationToSeconds(secondsToDuration(totalSeconds, units)) === Math.floor(totalSeconds)
}

/**
 * Carry overflow from smaller units into larger ones.
 *
 * Typing `90` into the minutes of an `h:m` field is legitimate — the range only
 * bounds what a *component* may be, not what the user may type on the way
 * there. Normalising on blur turns it into `1h 30m`, which is the same duration
 * written the way the field is shaped. Units the field does not show are left
 * alone, so nothing is invented and nothing is lost.
 */
export function normalise(parts: DurationParts, units: readonly DurationUnit[]): DurationParts {
  if (isEmpty(parts)) return parts
  const shown = UNIT_ORDER.filter((unit) => units.includes(unit))
  // Nothing to carry into when a single unit is on screen; it is the leading
  // unit, and the leading unit is unbounded by design.
  if (shown.length < 2) return parts

  const next: Record<DurationUnit, number | null> = { ...parts }
  // Smallest first, carrying upward into the next unit the field actually shows.
  for (let index = shown.length - 1; index > 0; index--) {
    const unit = shown[index]
    const above = shown[index - 1]
    /* v8 ignore next */
    if (unit === undefined || above === undefined) continue
    const value = next[unit]
    if (value === null) continue
    const perAbove = UNIT_SECONDS[above] / UNIT_SECONDS[unit]
    const carry = Math.floor(value / perAbove)
    if (carry === 0) continue
    next[unit] = value - carry * perAbove
    next[above] = (next[above] ?? 0) + carry
  }
  return next
}

/**
 * An ISO 8601 duration for a complete set of parts; `null` when incomplete.
 *
 * `PT0S` for a zero duration rather than the shorter `P0D` or the illegal `P`:
 * every unit-less form is either ambiguous or invalid, and `PT0S` is what every
 * parser in the wild recognises.
 */
export function toISODuration(parts: DurationParts, units: readonly DurationUnit[]): string | null {
  if (!isComplete(parts, units)) return null
  for (const unit of units) {
    const value = parts[unit]
    if (value === null || !Number.isFinite(value) || value < 0) return null
  }

  let date = ''
  let time = ''
  for (const unit of UNIT_ORDER) {
    const value = parts[unit]
    if (value === null || value === 0) continue
    const token = `${String(value)}${UNIT_LETTER[unit]}`
    if (unit === 'day') date += token
    else time += token
  }

  if (date === '' && time === '') return 'PT0S'
  return `P${date}${time === '' ? '' : `T${time}`}`
}

/**
 * Why parsing failed, so the caller can say something useful about it.
 *
 * `calendar-unit` is its own outcome because it is the classic ISO duration
 * bug, and because the input is otherwise perfectly well-formed: `P1M` is a
 * valid duration, it just is not one a field made of fixed-length units can
 * hold.
 */
export type DurationParseError = 'malformed' | 'calendar-unit'

export interface DurationParseFailure {
  ok: false
  error: DurationParseError
}

export interface DurationParseSuccess {
  ok: true
  seconds: number
}

export type DurationParseResult = DurationParseSuccess | DurationParseFailure

/**
 * The full ISO 8601 duration grammar, minus the alternative `P<datetime>` form.
 *
 * Written as one expression so the `T` boundary is structural rather than
 * something the code has to remember: `M` before the `T` is months, `M` after
 * it is minutes. Getting that wrong by hand is *the* bug in naive parsers, and
 * it is a 43,200× error.
 */
const ISO_DURATION =
  /^([+-])?P(?!$)(?:(\d+(?:[.,]\d+)?)Y)?(?:(\d+(?:[.,]\d+)?)M)?(?:(\d+(?:[.,]\d+)?)W)?(?:(\d+(?:[.,]\d+)?)D)?(?:T(?!$)(?:(\d+(?:[.,]\d+)?)H)?(?:(\d+(?:[.,]\d+)?)M)?(?:(\d+(?:[.,]\d+)?)S)?)?$/

/** `1,5` is as legal as `1.5` in ISO 8601; JavaScript only knows the dot. */
function decimal(raw: string | undefined): number {
  return raw === undefined ? 0 : Number(raw.replace(',', '.'))
}

/**
 * Parse an ISO 8601 duration into whole seconds.
 *
 * Years and months are refused rather than approximated. They are not a fixed
 * number of seconds — February is 28 or 29 days, a month is 28 to 31 — so any
 * conversion is a guess, and a field whose whole job is exactness has no
 * business guessing. Weeks *are* fixed at seven days and are accepted.
 *
 * Fractional components are accepted (ISO allows them on the smallest present
 * unit) and floored to the second, because a field made of integer spinbuttons
 * cannot represent anything finer.
 */
export function parseISODuration(value: string): DurationParseResult {
  // Typed as a string and checked anyway: this is a public entry point and the
  // props that reach it come from JSON payloads and loosely-typed form
  // libraries, where a number of seconds arriving instead of a string is the
  // single most likely mistake. `.trim()` on one would throw from inside render.
  if (typeof value !== 'string') return { ok: false, error: 'malformed' }
  const match = ISO_DURATION.exec(value.trim())
  if (!match) return { ok: false, error: 'malformed' }

  const [, sign, years, months, weeks, days, hours, minutes, seconds] = match

  // A negative duration is well-formed ISO and meaningless in a field whose
  // segments are unsigned counts. Refused rather than silently made positive.
  if (sign === '-') return { ok: false, error: 'malformed' }
  if (years !== undefined || months !== undefined) return { ok: false, error: 'calendar-unit' }

  const total =
    decimal(weeks) * 7 * UNIT_SECONDS.day +
    decimal(days) * UNIT_SECONDS.day +
    decimal(hours) * UNIT_SECONDS.hour +
    decimal(minutes) * UNIT_SECONDS.minute +
    decimal(seconds)

  if (!Number.isFinite(total)) return { ok: false, error: 'malformed' }
  return { ok: true, seconds: Math.floor(total) }
}

/** Parse an ISO 8601 duration into the parts a field shows, or `null`. */
export function fromISODuration(
  value: string,
  units: readonly DurationUnit[],
): DurationParts | null {
  const parsed = parseISODuration(value)
  if (!parsed.ok) return null
  return secondsToDuration(parsed.seconds, units)
}

/** An ISO 8601 duration in whole seconds, or `null` when it is not one. */
export function toSeconds(value: string): number | null {
  const parsed = parseISODuration(value)
  return parsed.ok ? parsed.seconds : null
}

/**
 * Order two ISO 8601 durations.
 *
 * Through seconds, never through `<`. This is the function the time field does
 * not need and this one cannot do without — see the note at the top of the file.
 * An unparseable operand sorts as equal rather than throwing, because this is
 * reached from render.
 */
export function compareDurations(a: string, b: string): number {
  const left = toSeconds(a)
  const right = toSeconds(b)
  if (left === null || right === null) return 0
  return left < right ? -1 : left > right ? 1 : 0
}

/** Whether a duration sits within an optional inclusive range. */
export function withinDurationRange(value: string, min?: string, max?: string): boolean {
  const seconds = toSeconds(value)
  if (seconds === null) return true
  const low = min === undefined ? null : toSeconds(min)
  const high = max === undefined ? null : toSeconds(max)
  if (low !== null && seconds < low) return false
  if (high !== null && seconds > high) return false
  return true
}

/** Clamp a value into an inclusive range — what Home and End land on. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
