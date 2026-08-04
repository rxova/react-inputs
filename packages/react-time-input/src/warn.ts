import { compareISO, fromISO } from './time'
import type { TimeWarning } from './types'

/**
 * Development-only diagnostics.
 *
 * Every function here is reached exclusively from the `NODE_ENV !== 'production'`
 * branch in `useTimeInput`, so a production bundler drops this whole module.
 * The coercion itself lives in the hook and always runs; this only *describes* a
 * coercion that already happened.
 */

/**
 * Describe a `value` / `defaultValue` that is not a 24-hour `HH:mm[:ss]`.
 *
 * The likely mistake is passing a *display* string — `2:30 PM`, or `9:05`
 * without the leading zero. Both leave the field empty, and neither is obvious
 * from looking at a blank input.
 */
export function inspectValue(raw: string, prop: string): TimeWarning | null {
  if (fromISO(raw) !== null) return null
  const looksLikeDisplay = /am|pm|\u5348/i.test(raw) || /^\d:/.test(raw)
  return {
    code: 'value-unparseable',
    prop,
    received: raw,
    message: looksLikeDisplay
      ? `\`${prop}\` is "${raw}", which is a display format. It must be a zero-padded 24-hour "HH:mm" or "HH:mm:ss" string — "14:30", not "2:30 PM". Rendering an empty field.`
      : `\`${prop}\` must be a zero-padded 24-hour "HH:mm" or "HH:mm:ss" string; received "${raw}". Rendering an empty field.`,
  }
}

/** Describe a `min` or `max` that is not a real time. */
export function inspectBound(raw: string, prop: 'min' | 'max'): TimeWarning | null {
  if (fromISO(raw) !== null) return null
  return {
    code: prop === 'min' ? 'min-unparseable' : 'max-unparseable',
    prop,
    received: raw,
    message: `\`${prop}\` must be a 24-hour "HH:mm" or "HH:mm:ss" string; received "${raw}". Ignoring it.`,
  }
}

/** Describe a range no time can satisfy. */
export function inspectRange(min: string | undefined, max: string | undefined): TimeWarning | null {
  if (min === undefined || max === undefined) return null
  if (fromISO(min) === null || fromISO(max) === null) return null
  if (compareISO(min, max) <= 0) return null
  return {
    code: 'min-after-max',
    prop: 'min',
    received: min,
    message: `\`min\` (${min}) is after \`max\` (${max}); no time can satisfy both. Ignoring both bounds. Note that this component does not model a range that wraps past midnight.`,
  }
}

/** Describe a completed time that falls outside the allowed range. */
export function inspectOutOfRange(
  value: string,
  min: string | undefined,
  max: string | undefined,
): TimeWarning | null {
  const tooEarly = min !== undefined && compareISO(value, min) < 0
  const tooLate = max !== undefined && compareISO(value, max) > 0
  if (!tooEarly && !tooLate) return null
  // The `?? ''` arm is unreachable: reaching the second branch means `tooLate`
  // is true, which already required `max` to be defined. It exists because the
  // parameter is optional.
  /* v8 ignore next 3 */
  const message = tooEarly
    ? `\`value\` (${value}) is before \`min\` (${min}). The field is marked invalid.`
    : `\`value\` (${value}) is after \`max\` (${max ?? ''}). The field is marked invalid.`
  return { code: 'value-out-of-range', prop: 'value', received: value, message }
}

/**
 * Describe a step that does not divide an hour.
 *
 * A 7-minute step leaves an 4-minute bucket at the top of every hour, so
 * arrowing up from :56 would land somewhere the grid does not contain. Falling
 * back to 1 is more predictable than an uneven final bucket.
 */
export function inspectStep(step: number, prop: string): TimeWarning | null {
  if (Number.isInteger(step) && step >= 1 && step <= 60 && 60 % step === 0) return null
  return {
    code: 'step-invalid',
    prop,
    received: String(step),
    message: `\`${prop}\` must be a whole number between 1 and 60 that divides 60 evenly; received ${String(step)}. Using 1.`,
  }
}

/** Describe a locale tag `Intl` refused. */
export function inspectLocale(locale: string): TimeWarning | null {
  try {
    new Intl.DateTimeFormat(locale)
    return null
  } catch {
    return {
      code: 'locale-invalid',
      prop: 'locale',
      received: locale,
      message: `\`locale\` "${locale}" is not a valid BCP 47 tag (note the hyphen: "en-US", not "en_US"). Falling back to a 24-hour clock.`,
    }
  }
}
