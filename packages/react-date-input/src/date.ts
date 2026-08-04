/**
 * Calendar arithmetic on plain numbers and ISO strings. No `Date` objects.
 *
 * That is the whole point of this module. `new Date('2026-03-01')` parses as
 * **UTC midnight**, while `new Date(2026, 2, 1)` parses as *local* midnight, so
 * the moment a date-only value touches a `Date` it acquires a timezone it never
 * had — and west of UTC, `new Date('2026-03-01').getDate()` is 28. That single
 * discrepancy is the source of most "my date picker is a day off" bug reports in
 * every library that models a calendar date as an instant.
 *
 * A calendar date is a year, a month and a day. It is not a point in time. So
 * this module never constructs one, and the values it produces are `YYYY-MM-DD`
 * strings — which, conveniently, sort lexicographically in exactly the same
 * order they sort chronologically, so range comparisons are string comparisons.
 */

/** The three editable parts of a date, in no particular order. */
export type DateSegment = 'day' | 'month' | 'year'

/** A partially-entered date. `null` means "that segment is still empty". */
export interface DateParts {
  year: number | null
  month: number | null
  day: number | null
}

/** Widest year this component will accept. Four digits, so the field can too. */
export const MIN_YEAR = 1
export const MAX_YEAR = 9999

export const EMPTY_PARTS: DateParts = { year: null, month: null, day: null }

/** Proleptic Gregorian, which is what ISO 8601 and every calendar UI mean. */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

/**
 * Days in a month, given what is known so far.
 *
 * Both arguments are nullable because the user types in whatever order they
 * like. With no month, 31 is the only safe upper bound — narrowing it early
 * would reject a valid `31` typed before the month. With a February and no
 * year, 29 is the safe answer for the same reason: a leap year is still
 * possible.
 */
export function daysInMonth(year: number | null, month: number | null): number {
  if (month === null || month < 1 || month > 12) return 31
  if (month === 2) return year === null || isLeapYear(year) ? 29 : 28
  /*
   * The `?? 31` is unreachable: `month` is already known to be 1-12 here, so
   * the lookup always hits. It exists because the array is indexed and TS types
   * that as possibly-undefined, and is excluded from coverage rather than
   * "covered" by a test that would have to call this with a month it rejects.
   */
  /* v8 ignore next */
  return MONTH_LENGTHS[month - 1] ?? 31
}

/** Inclusive bounds for a segment, given the other segments. */
export function segmentRange(segment: DateSegment, parts: DateParts): { min: number; max: number } {
  if (segment === 'year') return { min: MIN_YEAR, max: MAX_YEAR }
  if (segment === 'month') return { min: 1, max: 12 }
  return { min: 1, max: daysInMonth(parts.year, parts.month) }
}

/** Zero-pad to `width` digits. */
export function pad(value: number, width: number): string {
  return String(value).padStart(width, '0')
}

/** Digits in a segment: four for a year, two for the rest. */
export function segmentWidth(segment: DateSegment): number {
  return segment === 'year' ? 4 : 2
}

/** Every segment filled in. Says nothing about whether the date exists. */
export function isComplete(parts: DateParts): boolean {
  return parts.year !== null && parts.month !== null && parts.day !== null
}

/**
 * `YYYY-MM-DD` for a complete, real date; `null` otherwise.
 *
 * "Real" matters: the segments allow 31 while the month is unknown, so a user
 * can legitimately arrive at 31 February by typing the day first. That is not a
 * date, and this returns null for it rather than silently rolling over into
 * March the way `new Date(2026, 1, 31)` would.
 */
export function toISO(parts: DateParts): string | null {
  const { year, month, day } = parts
  if (year === null || month === null || day === null) return null
  if (year < MIN_YEAR || year > MAX_YEAR) return null
  if (month < 1 || month > 12) return null
  if (day < 1 || day > daysInMonth(year, month)) return null
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`
}

/** Parse `YYYY-MM-DD`. Anything else — including a real date in another format — is `null`. */
export function fromISO(iso: string): DateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  // Round-trip through the same validity rules `toISO` applies, so a string
  // like "2026-02-31" is rejected rather than becoming a date that is not real.
  const parts = { year, month, day }
  return toISO(parts) === null ? null : parts
}

/**
 * Chronological comparison, done as a string comparison.
 *
 * Only correct because `YYYY-MM-DD` is fixed-width and big-endian — which is
 * exactly why the format was chosen for the public value.
 */
export function compareISO(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** Whether an ISO date sits within an optional inclusive range. */
export function withinRange(iso: string, min?: string, max?: string): boolean {
  if (min !== undefined && compareISO(iso, min) < 0) return false
  if (max !== undefined && compareISO(iso, max) > 0) return false
  return true
}

/**
 * Re-clamp the day after the month or year changes.
 *
 * Typing 31 January and then switching the month to February has to land
 * somewhere. Clamping to the 28th keeps the field in a valid state and keeps
 * the user's month choice, which is the edit they just made; rolling over to
 * 3 March (what `Date` would do) silently changes the month they picked, and
 * clearing the day throws away input they did not ask to lose.
 */
export function clampDay(parts: DateParts): DateParts {
  if (parts.day === null) return parts
  const max = daysInMonth(parts.year, parts.month)
  return parts.day > max ? { ...parts, day: max } : parts
}

/** Wrap `value` around an inclusive range — what the arrow keys do at the ends. */
export function wrap(value: number, min: number, max: number): number {
  const span = max - min + 1
  return ((((value - min) % span) + span) % span) + min
}
