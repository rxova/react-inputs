import type { TimeSegment } from './time'

/**
 * Segment order, separators and 12/24-hour choice, taken from the platform.
 *
 * `Intl.DateTimeFormat` already knows that `en-US` writes `2:30 PM` and
 * `de-DE` writes `14:30`, and where the day period sits — before the time in
 * `zh-CN`, after it in English. Asking it costs zero bytes, because every
 * engine ships ICU anyway. The alternative is a bundled format table that is
 * wrong about the locales it forgot.
 */

/** One rendered piece: an editable segment, or the text between two of them. */
export type TimePiece = { kind: 'segment'; type: TimeSegment } | { kind: 'literal'; text: string }

/** 24-hour `HH:mm`, used when `Intl` is unavailable or gives us nothing usable. */
function fallback(showSeconds: boolean): TimePiece[] {
  const pieces: TimePiece[] = [
    { kind: 'segment', type: 'hour' },
    { kind: 'literal', text: ':' },
    { kind: 'segment', type: 'minute' },
  ]
  if (showSeconds) {
    pieces.push({ kind: 'literal', text: ':' }, { kind: 'segment', type: 'second' })
  }
  return pieces
}

/**
 * A fixed reference instant: 23:45:56 UTC on an arbitrary day.
 *
 * Every component differs and all are two digits, so no part of the formatted
 * output can be mistaken for another. The hour is past noon so the day period
 * is the PM form, which is the one that reveals where the locale puts it.
 */
const REFERENCE = new Date(Date.UTC(2001, 0, 1, 23, 45, 56))

/** Whether a locale writes the time on a 12-hour clock. */
export function usesHour12(locale?: string): boolean {
  try {
    const resolved = new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
    }).resolvedOptions()
    // `hour12` is optional in the resolved options; `hourCycle` is the modern
    // spelling and is present where it is not. Reading both avoids depending on
    // which one a given engine reports.
    if (typeof resolved.hour12 === 'boolean') return resolved.hour12
    // Every engine we test on reports `hour12`, so this line is the belt to
    // that braces. Excluded from coverage rather than faked with a stub of
    // `Intl`, which would only prove the stub works.
    /* v8 ignore next */
    return resolved.hourCycle === 'h11' || resolved.hourCycle === 'h12'
  } catch {
    // An invalid locale tag throws RangeError. A time field that throws because
    // someone passed "en_US" instead of "en-US" is a worse outcome than one
    // that quietly falls back to a 24-hour clock.
    return false
  }
}

/**
 * The pieces of a time field for a locale, in display order.
 *
 * Only `hour`, `minute`, `second` and `dayPeriod` survive; anything else the
 * locale adds is dropped, because this component edits those and nothing else.
 */
export function timePieces(
  locale: string | undefined,
  showSeconds: boolean,
  hour12: boolean,
): TimePiece[] {
  let parts: Intl.DateTimeFormatPart[]
  try {
    parts = new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
      ...(showSeconds ? { second: '2-digit' } : {}),
      hour12,
      timeZone: 'UTC',
    }).formatToParts(REFERENCE)
  } catch {
    return fallback(showSeconds)
  }

  const pieces: TimePiece[] = []
  let first = -1
  let last = -1
  let seen = 0

  for (const part of parts) {
    if (
      part.type === 'hour' ||
      part.type === 'minute' ||
      part.type === 'second' ||
      part.type === 'dayPeriod'
    ) {
      pieces.push({ kind: 'segment', type: part.type })
      if (first < 0) first = pieces.length - 1
      last = pieces.length - 1
      seen++
    } else {
      pieces.push({ kind: 'literal', text: part.value })
    }
  }

  // Defensive: the options above request hour and minute, so an engine
  // returning fewer would be broken.
  /* v8 ignore next */
  if (seen < 2) return fallback(showSeconds)

  // Everything outside the first and last segment is trimmed — some locales
  // prefix or suffix the whole time, and an affix beside an editable field
  // reads as stray punctuation.
  return pieces.slice(first, last + 1)
}

/**
 * The localised AM and PM strings.
 *
 * Hard-coding "AM"/"PM" would be wrong in most of the world — `es` writes
 * `a. m.`, `ja` writes `午前`. `Intl` knows them all.
 */
export function dayPeriodNames(locale?: string): [string, string] {
  try {
    const format = new Intl.DateTimeFormat(locale, {
      hour: 'numeric',
      hour12: true,
      timeZone: 'UTC',
    })
    const read = (date: Date) =>
      format.formatToParts(date).find((part) => part.type === 'dayPeriod')?.value
    const am = read(new Date(Date.UTC(2001, 0, 1, 9)))
    const pm = read(new Date(Date.UTC(2001, 0, 1, 21)))
    // A locale with no day period at all would report none. Asking for
    // `hour12: true` makes every locale we test on produce one, so this is a
    // guard rather than a path — excluded from coverage rather than faked with
    // a stub of `Intl`, which would only prove the stub works.
    /* v8 ignore next */
    if (am === undefined || pm === undefined) return ['AM', 'PM']
    return [am, pm]
  } catch {
    return ['AM', 'PM']
  }
}
