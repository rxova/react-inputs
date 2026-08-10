import { UNIT_ORDER, fitsUnits, parseISODuration, toSeconds } from './duration'
import type { DurationUnit } from './duration'
import type { DurationWarning } from './types'

/**
 * Development-only diagnostics.
 *
 * Every function here is reached exclusively from the `NODE_ENV !== 'production'`
 * branch in `useDurationInput`, so a production bundler drops this whole module.
 * The coercion itself lives in the hook and always runs; this only *describes* a
 * coercion that already happened.
 */

/** The suffix every message ends with when a value could not be read at all. */
const ISO_HINT =
  'It must be an ISO 8601 duration: `PT30M` for thirty minutes, `PT1H30M` for an hour and a half, `P2DT4H` for two days and four hours.'

/**
 * Describe a `value` / `defaultValue` that is not an ISO 8601 duration.
 *
 * Three mistakes are common enough to name individually. A bare number is
 * someone passing seconds or milliseconds, which is what most of the ecosystem
 * stores. `90:00` is a *display* format. And `P1M` is the one that would
 * otherwise be silently wrong: in ISO 8601 that is one month, not one minute,
 * and treating it as a minute is a 43,200× error.
 */
export function inspectValue(received: unknown, prop: string): DurationWarning | null {
  // Stringified up front rather than trusted: the same non-string values
  // `parseISODuration` guards against reach here, and a diagnostic that throws
  // while explaining a bad prop is the worst of both.
  const raw = typeof received === 'string' ? received : JSON.stringify(received)
  const parsed = parseISODuration(raw)
  if (parsed.ok) return null

  if (parsed.error === 'calendar-unit') {
    return {
      code: 'value-calendar-unit',
      prop,
      received: raw,
      message: `\`${prop}\` is "${raw}", which uses years or months. In ISO 8601 \`P1M\` is one *month*, not one minute — the minute form is \`PT1M\`, with the \`T\`. Months and years are not a fixed number of seconds, so this field cannot hold them. Rendering an empty field.`,
    }
  }

  const looksNumeric = /^-?\d+(\.\d+)?$/.test(raw.trim())
  const looksClocklike = /^\d+:\d/.test(raw.trim())
  const hint = looksNumeric
    ? `\`${prop}\` is "${raw}", which is a bare number. This field takes an ISO 8601 duration string, not seconds or milliseconds — wrap it, e.g. \`secondsToDuration\` then \`toISODuration\`, or write \`PT${raw.trim()}S\`.`
    : looksClocklike
      ? `\`${prop}\` is "${raw}", which is a clock format. ${ISO_HINT}`
      : `\`${prop}\` must be an ISO 8601 duration; received "${raw}". ${ISO_HINT}`

  return {
    code: 'value-unparseable',
    prop,
    received: raw,
    message: `${hint} Rendering an empty field.`,
  }
}

/**
 * Describe a value the visible units cannot hold exactly.
 *
 * `PT90S` in an `h:m` field is one minute and thirty lost seconds. The field
 * shows the minute — refusing the value outright would be worse — but the loss
 * is silent from the outside, and a form that round-trips it would write back a
 * different duration than it read.
 */
export function inspectTruncation(
  raw: string,
  units: readonly DurationUnit[],
  prop: string,
): DurationWarning | null {
  const seconds = toSeconds(raw)
  if (seconds === null || fitsUnits(seconds, units)) return null
  // `units` always arrives from `usableUnits`, which never returns an empty
  // array — the fallback exists for the type, not for a reachable state.
  /* v8 ignore next */
  const smallest = units[units.length - 1] ?? 'second'
  return {
    code: 'value-truncated',
    prop,
    received: raw,
    message: `\`${prop}\` is "${raw}", which is finer than the units this field shows. It is truncated to whole ${smallest}s, so reading the value back will not return "${raw}". Add \`${smallest === 'minute' ? "'second'" : 'a smaller unit'}\` to \`units\`, or round the value before passing it.`,
  }
}

/** Describe a `min` or `max` that is not a real duration. */
export function inspectBound(raw: string, prop: 'min' | 'max'): DurationWarning | null {
  if (parseISODuration(raw).ok) return null
  return {
    code: prop === 'min' ? 'min-unparseable' : 'max-unparseable',
    prop,
    received: raw,
    message: `\`${prop}\` must be an ISO 8601 duration; received "${raw}". ${ISO_HINT} Ignoring it.`,
  }
}

/**
 * Describe a range no duration can satisfy.
 *
 * Compared through seconds, not with `<`. `min="PT10M" max="PT2H"` is a
 * perfectly good range that a string comparison would reject, which is exactly
 * the bug this component exists to not have.
 */
export function inspectRange(
  min: string | undefined,
  max: string | undefined,
): DurationWarning | null {
  if (min === undefined || max === undefined) return null
  const low = toSeconds(min)
  const high = toSeconds(max)
  if (low === null || high === null) return null
  if (low <= high) return null
  return {
    code: 'min-after-max',
    prop: 'min',
    received: min,
    message: `\`min\` (${min}) is longer than \`max\` (${max}); no duration can satisfy both. Ignoring both bounds.`,
  }
}

/** Describe a completed duration that falls outside the allowed range. */
export function inspectOutOfRange(
  value: string,
  min: string | undefined,
  max: string | undefined,
): DurationWarning | null {
  const seconds = toSeconds(value)
  /* v8 ignore next */
  if (seconds === null) return null
  const low = min === undefined ? null : toSeconds(min)
  const high = max === undefined ? null : toSeconds(max)
  const tooShort = low !== null && seconds < low
  const tooLong = high !== null && seconds > high
  if (!tooShort && !tooLong) return null
  // The `?? ''` arms are unreachable: reaching either branch already required
  // that bound to be defined. They exist because the parameters are optional.
  /* v8 ignore next 3 */
  const message = tooShort
    ? `\`value\` (${value}) is shorter than \`min\` (${min ?? ''}). The field is marked invalid.`
    : `\`value\` (${value}) is longer than \`max\` (${max ?? ''}). The field is marked invalid.`
  return { code: 'value-out-of-range', prop: 'value', received: value, message }
}

/**
 * Describe a `units` array that had to be repaired.
 *
 * Both repairs are silent by nature — a reordered array still renders a working
 * field — so the warning is the only way to notice that `['minute', 'hour']`
 * was not honoured as written.
 */
export function inspectUnits(units: readonly unknown[]): DurationWarning | null {
  const unknownUnits = units.filter(
    (unit) => typeof unit !== 'string' || !UNIT_ORDER.includes(unit as DurationUnit),
  )
  if (unknownUnits.length > 0) {
    return {
      code: 'units-invalid',
      prop: 'units',
      received: JSON.stringify(units),
      message: `\`units\` contains ${unknownUnits.map((unit) => JSON.stringify(unit)).join(', ')}, which ${unknownUnits.length === 1 ? 'is not a unit' : 'are not units'} this field edits. Allowed: 'day', 'hour', 'minute', 'second'. Note that months and years are absent on purpose — they are not a fixed number of seconds. Ignoring the rest.`,
    }
  }

  if (units.length === 0) {
    return {
      code: 'units-invalid',
      prop: 'units',
      received: '[]',
      message: `\`units\` is empty, which would render a field with nothing to type into. Using ['hour', 'minute'].`,
    }
  }

  const seen = units as readonly DurationUnit[]
  const deduped = UNIT_ORDER.filter((unit) => seen.includes(unit))
  if (deduped.length === seen.length && deduped.every((unit, index) => seen[index] === unit)) {
    return null
  }
  return {
    code: 'units-invalid',
    prop: 'units',
    received: JSON.stringify(units),
    message: `\`units\` is ${JSON.stringify(units)}; rendering ${JSON.stringify(deduped)} instead. A duration is written largest-unit-first, and the largest unit on screen is the unbounded one — reversing them would put a 0–59 segment ahead of an open-ended one.`,
  }
}

/**
 * Describe a step that does not divide 60.
 *
 * A 7-minute step leaves a 4-minute bucket at the top of every hour, so
 * arrowing up from 56 would land somewhere the grid does not contain. Falling
 * back to 1 is more predictable than an uneven final bucket.
 */
export function inspectStep(step: number, prop: string): DurationWarning | null {
  if (Number.isInteger(step) && step >= 1 && step <= 60 && 60 % step === 0) return null
  return {
    code: 'step-invalid',
    prop,
    received: String(step),
    message: `\`${prop}\` must be a whole number between 1 and 60 that divides 60 evenly; received ${String(step)}. Using 1.`,
  }
}

/** Describe a locale tag `Intl` refused. */
export function inspectLocale(locale: string): DurationWarning | null {
  try {
    new Intl.NumberFormat(locale)
    return null
  } catch {
    return {
      code: 'locale-invalid',
      prop: 'locale',
      received: locale,
      message: `\`locale\` "${locale}" is not a valid BCP 47 tag (note the hyphen: "en-US", not "en_US"). Falling back to d / h / m / s.`,
    }
  }
}
