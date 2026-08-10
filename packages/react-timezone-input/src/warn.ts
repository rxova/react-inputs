import { isOffsetZone, isUsableZone, zoneOffsetMinutes } from './zones'
import type { TimezoneWarning } from './types'

/**
 * Development-only diagnostics.
 *
 * Every function here is reached exclusively from the `NODE_ENV !== 'production'`
 * branch in `useTimezoneInput`, so a production bundler drops this whole module.
 * Nothing outside that branch may call into this file — the measurement input
 * shipped with one such call and it quietly kept its diagnostics in every
 * production bundle.
 */

const SHAPE_HINT =
  'It must be an IANA time zone id: `"Europe/Madrid"`, `"America/New_York"`, `"UTC"`.'

/** Quote a value for a message without letting a non-string throw on the way. */
function show(received: unknown): string {
  if (typeof received === 'string') return received
  try {
    const json: unknown = JSON.stringify(received)
    return typeof json === 'string' ? json : String(received)
  } catch {
    /* v8 ignore next 2 */
    return String(received)
  }
}

/** Anything that looks like an offset rather than a zone: `+02:00`, `GMT+2`, `-0500`. */
function looksLikeOffset(raw: string): boolean {
  return /^(?:GMT|UTC)?[+-]\d{1,2}(?::?\d{2})?$/i.test(raw.trim())
}

/**
 * Describe a `value` / `defaultValue` the field cannot use as given.
 *
 * Four outcomes rather than one, because they call for four different fixes.
 * The offset case is the one worth naming: storing `-05:00` instead of
 * `America/New_York` is the mistake this component exists to make impossible,
 * and it is silent for half the year.
 */
export function inspectValue(received: unknown, prop: string): TimezoneWarning | null {
  const raw = show(received)

  // Before the usable branch, because ECMA-402 *does* accept `+02:00` as a
  // time zone — so this case would otherwise be unreachable.
  if (isOffsetZone(received) || looksLikeOffset(raw)) {
    return {
      code: 'value-offset-not-zone',
      prop,
      received: raw,
      message: `\`${prop}\` is "${raw}", which is an offset rather than a zone. \`Intl\` accepts it, but an offset cannot round-trip: "-05:00" is New York in winter and nothing in particular in summer, and it can never express a daylight-saving change. Store the id — "America/New_York" — and let the offset be derived. Rendering an empty field.`,
    }
  }

  if (isUsableZone(received)) {
    if (/^Etc\/GMT[+-]/.test(received)) {
      const minutes = zoneOffsetMinutes(received) ?? 0
      return {
        code: 'value-etc-inverted',
        prop,
        received: raw,
        message: `\`${prop}\` is "${raw}". POSIX signs run backwards in the \`Etc/GMT\` zones, so this is UTC${minutes < 0 ? '' : '+'}${String(minutes / 60)} — the opposite of what it reads. Use a real zone id, or "UTC" if you mean UTC.`,
      }
    }
    /*
     * No "usable but unlisted" warning, because that case cannot arise:
     * `resolvedOptions()` returns a canonical id and `supportedValuesOf`
     * lists the canonical ids, so the two agree by construction. The only
     * exceptions are the `Etc/GMT±N` zones, which ICU excludes from the list
     * and which the branch above already explains in more useful terms.
     */
    return null
  }

  return {
    code: 'value-unknown-zone',
    prop,
    received: raw,
    message: `\`${prop}\` is "${raw}", which this engine does not recognise as a time zone. ${SHAPE_HINT} Rendering an empty field.`,
  }
}

/** Describe a `zones` array that had to be repaired. */
export function inspectZones(zones: readonly unknown[]): TimezoneWarning | null {
  const received = show(zones)
  const unusable = zones.filter((zone) => !isUsableZone(zone))

  // Length rather than `first !== undefined`, because `undefined` is itself one
  // of the things a consumer can put in the array.
  if (unusable.length > 0) {
    return {
      code: 'zones-invalid',
      prop: 'zones',
      received,
      message: `\`zones\` contains ${show(unusable[0])}, which this engine does not recognise as a time zone. ${SHAPE_HINT} Dropping it.`,
    }
  }

  if (zones.length === 0) {
    return {
      code: 'zones-empty',
      prop: 'zones',
      received: '[]',
      message:
        '`zones` is empty, which would render a field with nothing to choose. Using every zone the platform knows.',
    }
  }

  return null
}

/**
 * Describe a `referenceDate` that is not a date.
 *
 * `new Date('2026-02-30')` is `Invalid Date` — an object that passes every type
 * check and makes `Intl` throw. Every offset would silently become `null`.
 */
export function inspectReferenceDate(when: unknown): TimezoneWarning | null {
  if (when instanceof Date && Number.isFinite(when.getTime())) return null
  return {
    code: 'reference-date-invalid',
    prop: 'referenceDate',
    received: show(when),
    message: `\`referenceDate\` must be a valid Date; received ${show(when)}. Offsets are computed at an instant, so without one there is nothing to compute them at. Using the current time.`,
  }
}

/** Describe a locale tag `Intl` refused. */
export function inspectLocale(locale: string): TimezoneWarning | null {
  try {
    new Intl.DateTimeFormat(locale)
    return null
  } catch {
    return {
      code: 'locale-invalid',
      prop: 'locale',
      received: locale,
      message: `\`locale\` "${locale}" is not a valid BCP 47 tag (note the hyphen: "en-US", not "en_US"). Falling back to the runtime's own locale.`,
    }
  }
}
