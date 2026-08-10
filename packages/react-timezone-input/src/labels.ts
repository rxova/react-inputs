import { formatOffset, zoneCity, zoneOffsetMinutes } from './zones'

/**
 * Everything that asks `Intl` for words rather than numbers.
 *
 * Kept apart from `zones.ts` for the same reason the duration and measurement
 * inputs keep their `segments.ts` apart: the arithmetic is deterministic and the
 * vocabulary is not. What a locale calls a zone depends on the engine's ICU
 * build, so every function here has a fallback and none of them throw.
 */

/** Build a formatter, or `null` if the engine refuses the zone or the tag. */
function formatter(
  zone: string,
  locale: string | undefined,
  timeZoneName: 'longGeneric' | 'long' | 'shortGeneric',
): Intl.DateTimeFormat | null {
  try {
    return new Intl.DateTimeFormat(locale, { timeZone: zone, timeZoneName })
  } catch {
    try {
      // An invalid BCP 47 tag is the likely cause — `en_US` with an underscore
      // is the classic mistake — and falling back to the runtime's own locale
      // is far better than a field that renders nothing.
      return new Intl.DateTimeFormat(undefined, { timeZone: zone, timeZoneName })
    } catch {
      // The zone itself is unusable, or the engine has no unit formatting at
      // all. Callers hold a fallback for this.
      return null
    }
  }
}

/** Pull the `timeZoneName` part out of a formatted date. */
function namePart(
  zone: string,
  locale: string | undefined,
  style: 'longGeneric' | 'long' | 'shortGeneric',
  when: Date,
): string | null {
  const format = formatter(zone, locale, style)
  if (format === null) return null
  try {
    const part = format.formatToParts(when).find((piece) => piece.type === 'timeZoneName')
    return part === undefined || part.value === '' ? null : part.value
  } catch {
    // `formatToParts` throws on an invalid Date rather than returning anything.
    return null
  }
}

/**
 * The locale's name for a zone — `Central European Time`, `heure d'Europe
 * centrale`.
 *
 * `longGeneric` rather than `long`, and the difference matters twice a year:
 * `long` is the *current phase* ("Eastern Daylight Time"), which is a fact about
 * today rather than about the zone, and it would relabel every option in the
 * list on the DST changeover. `longGeneric` says "Eastern Time" all year.
 *
 * Falls back to the city out of the id, which is always available because it is
 * just string surgery — so a zone ICU has no name for still reads as a place
 * rather than as a blank.
 */
export function zoneLabel(zone: string, locale?: string, when: Date = new Date()): string {
  const name = namePart(zone, locale, 'longGeneric', when)
  // ICU answers `GMT+05:45` for a zone it has no name for — UTC among them,
  // which is how `UTC` ended up rendering as `(+00:00) GMT+00:00 — UTC`. That
  // is the offset again, not a name, so the city is the better answer.
  if (name === null || /^GMT([+-]\d{2}:\d{2})?$/.test(name)) return zoneCity(zone)
  return name
}

/**
 * The zone's *current* phase name — `Eastern Daylight Time` — or `null`.
 *
 * Deliberately separate from {@link zoneLabel} and not used in the option list.
 * It is the right thing to show beside a chosen zone ("currently on summer
 * time") and the wrong thing to label an option with.
 */
export function zonePhase(zone: string, locale?: string, when: Date = new Date()): string | null {
  return namePart(zone, locale, 'long', when)
}

/** `+02:00` at a given instant, or `null` when the zone is not usable. */
export function zoneOffsetLabel(zone: string, when: Date = new Date()): string | null {
  const minutes = zoneOffsetMinutes(zone, when)
  return minutes === null ? null : formatOffset(minutes)
}

/**
 * The whole option text: `Madrid — Central European Time (+02:00)`.
 *
 * One string rather than a layout, because this goes inside an `<option>`, and
 * an `<option>` may contain text and nothing else.
 *
 * **The city leads, and that is not a cosmetic choice.** A native select's
 * type-ahead matches from the start of the option's text, so an offset-first
 * label — `(+02:00) Central European Time — Madrid` — means pressing `m` jumps
 * nowhere, because the string starts with a bracket. With 419 options sorted by
 * offset rather than alphabetically, type-ahead is the *only* fast way to reach
 * a zone, so leading with the word people actually type is the difference
 * between a usable field and a scroll. The phone input learned the same lesson
 * from a leading flag emoji; the comment in `PhoneInput.tsx` records it.
 */
export function zoneOptionLabel(zone: string, locale?: string, when: Date = new Date()): string {
  const offset = zoneOffsetLabel(zone, when)
  const name = zoneLabel(zone, locale, when)
  const city = zoneCity(zone)
  // Only when the name is not already the city — otherwise `UTC — UTC`.
  const head = name === city ? city : `${city} — ${name}`
  return offset === null ? head : `${head} (${offset})`
}
