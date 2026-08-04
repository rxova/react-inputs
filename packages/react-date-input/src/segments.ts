import type { DateSegment } from './date'

/**
 * Segment order and separators, taken from the platform.
 *
 * `Intl.DateTimeFormat` already knows that `en-US` writes month first, `en-GB`
 * day first, and `ja-JP` year first — and which separator each uses. Asking it
 * costs zero bytes, because every engine ships ICU data anyway. The alternative
 * every other library takes is to bundle a format table (or all of `date-fns`)
 * and then be wrong about the locales it forgot.
 */

/** One rendered piece: an editable segment, or the text between two of them. */
export type DatePiece = { kind: 'segment'; type: DateSegment } | { kind: 'literal'; text: string }

/** ISO order, used when `Intl` is unavailable or gives us nothing usable. */
const FALLBACK: DatePiece[] = [
  { kind: 'segment', type: 'year' },
  { kind: 'literal', text: '-' },
  { kind: 'segment', type: 'month' },
  { kind: 'literal', text: '-' },
  { kind: 'segment', type: 'day' },
]

/**
 * A fixed, unambiguous reference date: 22 November 3333.
 *
 * Every component is two digits or more and all three differ, so no part of the
 * formatted output can be mistaken for another. A date like 1 January 2000
 * would produce "1/1/2000", where the day and month are indistinguishable and
 * the parts have to be identified by `type` anyway — which works, but makes the
 * function impossible to debug by looking at it.
 *
 * Constructed from a UTC timestamp rather than `new Date(3333, 10, 22)` so the
 * machine's timezone cannot shift it across a day boundary.
 */
const REFERENCE = new Date(Date.UTC(3333, 10, 22))

/**
 * The pieces of a date field for a locale, in display order.
 *
 * Only `day`, `month` and `year` survive; anything else the locale wants to add
 * (an era, a weekday, a calendar name) is dropped, because this component edits
 * three numbers and cannot edit those.
 */
export function datePieces(locale?: string): DatePiece[] {
  let parts: Intl.DateTimeFormatPart[]
  try {
    parts = new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'UTC',
    }).formatToParts(REFERENCE)
  } catch {
    // An invalid locale tag throws RangeError. A date field that throws because
    // someone passed "en_US" instead of "en-US" is a worse outcome than one
    // that quietly falls back to ISO order.
    return FALLBACK
  }

  const pieces: DatePiece[] = []
  let seen = 0
  let first = -1
  let last = -1

  for (const part of parts) {
    if (part.type === 'day' || part.type === 'month' || part.type === 'year') {
      pieces.push({ kind: 'segment', type: part.type })
      if (first < 0) first = pieces.length - 1
      last = pieces.length - 1
      seen++
    } else {
      pieces.push({ kind: 'literal', text: part.value })
    }
  }

  // Defensive: the options above request all three parts, so an engine that
  // returned fewer would be broken. Excluded from coverage rather than faked
  // with a mock of `Intl`.
  /* v8 ignore next */
  if (seen < 3) return FALLBACK

  // Everything outside the first and last segment is trimmed. `ko-KR` and
  // `hu-HU` end with a trailing "." and `ja-JP` with a "日" — correct for
  // display, but a dangling character after an editable field. Slicing by the
  // segment positions handles a leading affix the same way without needing a
  // separate branch for a case no current locale exercises.
  return pieces.slice(first, last + 1)
}

/** Just the segments, in display order. */
export function segmentOrder(locale?: string): DateSegment[] {
  return datePieces(locale).flatMap((piece) => (piece.kind === 'segment' ? [piece.type] : []))
}

/**
 * Month names for the `aria-valuetext` of the month segment.
 *
 * A screen reader announcing "2" for the month segment is technically the value
 * and practically useless; "February" is what the user needs. Again, `Intl`
 * already knows this in every locale.
 */
export function monthNames(locale?: string): string[] {
  try {
    const format = new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' })
    return Array.from({ length: 12 }, (_unused, index) =>
      format.format(new Date(Date.UTC(2001, index, 15))),
    )
  } catch {
    return [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ]
  }
}
