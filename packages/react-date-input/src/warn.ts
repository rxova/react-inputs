import { compareISO, fromISO } from './date'
import type { DateWarning } from './types'

/**
 * Development-only diagnostics.
 *
 * Every function here is reached exclusively from the `NODE_ENV !== 'production'`
 * branch in `useDateInput`, so a production bundler drops this whole module.
 * The coercion itself lives in the hook and always runs; this only *describes* a
 * coercion that already happened.
 */

/**
 * Describe a `value` / `defaultValue` that is not a real ISO date.
 *
 * Both halves matter and fail differently: `"03/01/2026"` is the wrong format,
 * and `"2026-02-31"` is the right format for a day that does not exist. Both
 * leave the field empty, and neither is obvious from looking at a blank input.
 */
export function inspectValue(raw: string, prop: string): DateWarning | null {
  if (fromISO(raw) !== null) return null
  const looksISO = /^\d{4}-\d{2}-\d{2}$/.test(raw)
  return {
    code: 'value-unparseable',
    prop,
    received: raw,
    message: looksISO
      ? `\`${prop}\` is "${raw}", which is not a real date. Rendering an empty field.`
      : `\`${prop}\` must be a "YYYY-MM-DD" string; received "${raw}". Rendering an empty field.`,
  }
}

/** Describe a `min` or `max` that is not a real ISO date. */
export function inspectBound(raw: string, prop: 'min' | 'max'): DateWarning | null {
  if (fromISO(raw) !== null) return null
  return {
    code: prop === 'min' ? 'min-unparseable' : 'max-unparseable',
    prop,
    received: raw,
    message: `\`${prop}\` must be a "YYYY-MM-DD" string; received "${raw}". Ignoring it.`,
  }
}

/** Describe a range no date can satisfy. */
export function inspectRange(min: string | undefined, max: string | undefined): DateWarning | null {
  if (min === undefined || max === undefined) return null
  if (fromISO(min) === null || fromISO(max) === null) return null
  if (compareISO(min, max) <= 0) return null
  return {
    code: 'min-after-max',
    prop: 'min',
    received: min,
    message: `\`min\` (${min}) is after \`max\` (${max}); no date can satisfy both. Ignoring both bounds.`,
  }
}

/** Describe a completed date that falls outside the allowed range. */
export function inspectOutOfRange(
  iso: string,
  min: string | undefined,
  max: string | undefined,
): DateWarning | null {
  // The bound is captured rather than re-read in the template so it is narrowed
  // to a string: `min`/`max` are optional, and the "which side" flags already
  // encode which of them is defined.
  const tooEarly = min !== undefined && compareISO(iso, min) < 0
  const tooLate = max !== undefined && compareISO(iso, max) > 0
  if (!tooEarly && !tooLate) return null
  const message = tooEarly
    ? `\`value\` (${iso}) is before \`min\` (${min}). The field is marked invalid.`
    : `\`value\` (${iso}) is after \`max\` (${max ?? ''}). The field is marked invalid.`
  return { code: 'value-out-of-range', prop: 'value', received: iso, message }
}

/** Describe a locale tag `Intl` refused. */
export function inspectLocale(locale: string): DateWarning | null {
  try {
    new Intl.DateTimeFormat(locale)
    return null
  } catch {
    return {
      code: 'locale-invalid',
      prop: 'locale',
      received: locale,
      message: `\`locale\` "${locale}" is not a valid BCP 47 tag (note the hyphen: "en-US", not "en_US"). Falling back to ISO segment order.`,
    }
  }
}
