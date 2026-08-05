/**
 * Clock arithmetic on plain numbers and `HH:mm[:ss]` strings. No `Date` objects.
 *
 * Same reasoning as the date field's `date.ts`, for a different reason. A time
 * of day is not an instant: `new Date('14:30')` is invalid, and
 * `new Date('2026-01-01T14:30')` is a *moment* that shifts with the timezone
 * and with daylight saving. "Half past two" does not.
 *
 * So this module never constructs one. The canonical value is a fixed-width
 * 24-hour string, which — like ISO dates — sorts lexicographically in exactly
 * the same order it sorts chronologically, so range comparisons are string
 * comparisons.
 */

/** The four editable parts. `dayPeriod` only exists in a 12-hour field. */
export type TimeSegment = 'hour' | 'minute' | 'second' | 'dayPeriod'

/** A partially-entered time. `null` means "that segment is still empty". */
export interface TimeParts {
  /** Always 0–23 internally, even when the field displays 12-hour. */
  hour: number | null
  minute: number | null
  second: number | null
}

export const EMPTY_PARTS: TimeParts = { hour: null, minute: null, second: null }

/** `AM` is 0, `PM` is 1 — an index, so it can be stepped and wrapped like a number. */
export const AM = 0
export const PM = 1

/** Zero-pad to `width` digits. */
export function pad(value: number, width: number): string {
  return String(value).padStart(width, '0')
}

/** Digits in a segment. Every time segment is two. */
export const SEGMENT_WIDTH = 2

/**
 * Inclusive bounds for a segment.
 *
 * The hour range is the one that changes: a 12-hour field shows 1–12 and a
 * 24-hour field 0–23. The *stored* hour is always 0–23; only the display and
 * the accepted keystrokes differ.
 */
export function segmentRange(segment: TimeSegment, hour12: boolean): { min: number; max: number } {
  if (segment === 'hour') return hour12 ? { min: 1, max: 12 } : { min: 0, max: 23 }
  if (segment === 'dayPeriod') return { min: AM, max: PM }
  return { min: 0, max: 59 }
}

/** The 1–12 hour a 12-hour field displays for a 0–23 hour. */
export function toDisplayHour(hour: number, hour12: boolean): number {
  if (!hour12) return hour
  const twelve = hour % 12
  return twelve === 0 ? 12 : twelve
}

/** The AM/PM half a 0–23 hour falls in. */
export function toDayPeriod(hour: number): number {
  return hour < 12 ? AM : PM
}

/**
 * Rebuild a 0–23 hour from a displayed 1–12 hour and a day period.
 *
 * The midnight/noon wrap is the part that is easy to get wrong: 12 AM is hour
 * 0 and 12 PM is hour 12, so the 12 has to be folded to 0 *before* the period
 * offset is added rather than after.
 */
export function fromDisplayHour(displayHour: number, dayPeriod: number): number {
  const folded = displayHour % 12
  return dayPeriod === PM ? folded + 12 : folded
}

/** Every segment the field needs is filled in. */
export function isComplete(parts: TimeParts, showSeconds: boolean): boolean {
  if (parts.hour === null || parts.minute === null) return false
  return !showSeconds || parts.second !== null
}

/**
 * `HH:mm` or `HH:mm:ss` for a complete, real time; `null` otherwise.
 *
 * Always 24-hour and always zero-padded, whatever the field displays. One
 * canonical format means a value can be compared, stored and sorted without
 * knowing which locale produced it.
 */
export function toISO(parts: TimeParts, showSeconds: boolean): string | null {
  const { hour, minute, second } = parts
  if (hour === null || minute === null) return null
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
  if (!showSeconds) return `${pad(hour, 2)}:${pad(minute, 2)}`
  if (second === null || second < 0 || second > 59) return null
  return `${pad(hour, 2)}:${pad(minute, 2)}:${pad(second, 2)}`
}

/**
 * Parse `HH:mm` or `HH:mm:ss`.
 *
 * Anything else is `null` — including `2:30 PM`, which is a *display* format.
 * Accepting it would make the prop's meaning depend on the locale.
 */
export function fromISO(value: string): TimeParts | null {
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value)
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  const second = match[3] === undefined ? null : Number(match[3])
  if (hour > 23 || minute > 59 || (second !== null && second > 59)) return null
  return { hour, minute, second }
}

/**
 * Chronological comparison, done as a string comparison.
 *
 * Correct because the format is fixed-width and big-endian. `HH:mm` and
 * `HH:mm:ss` are compared on their shared prefix, so a bound given without
 * seconds still orders correctly against a value that has them.
 */
export function compareISO(a: string, b: string): number {
  const length = Math.min(a.length, b.length)
  const left = a.slice(0, length)
  const right = b.slice(0, length)
  return left < right ? -1 : left > right ? 1 : 0
}

/** Whether a time sits within an optional inclusive range. */
export function withinRange(value: string, min?: string, max?: string): boolean {
  if (min !== undefined && compareISO(value, min) < 0) return false
  if (max !== undefined && compareISO(value, max) > 0) return false
  return true
}

/** Wrap `value` around an inclusive range — what the arrow keys do at the ends. */
export function wrap(value: number, min: number, max: number): number {
  const span = max - min + 1
  return ((((value - min) % span) + span) % span) + min
}

/*
 * There is deliberately no `snapToStep` here.
 *
 * One existed, fully unit-tested, exported from this module and called from
 * nowhere — the kind of dead code that reads as a feature. `minuteStep` and
 * `secondStep` move the arrow keys onto a grid and stop there; a typed or
 * controlled value is left exactly as given, because enforcing the grid
 * mid-entry fights the user and validating the final value is the form's job.
 * That is limitation 35 in CONSIDERATIONS.md, and it is the intended contract
 * rather than an omission. Anything that snaps belongs in `stepFor`, next to
 * the arrows it serves.
 */
