/**
 * IANA time zones, taken entirely from the platform.
 *
 * This is the suite's premise at its sharpest. The popular alternative,
 * `react-timezone-select`, has two runtime dependencies — `spacetime` and
 * `timezone-soft` — and they exist to carry a bundled copy of the tz database.
 * That copy is wrong the moment a government moves its DST rules, and a package
 * update is the only way to fix it.
 *
 * `Intl` ships the same data, maintained by the engine's ICU, and answers every
 * question this component has:
 *
 * - `Intl.supportedValuesOf('timeZone')` — the zone list.
 * - `Intl.DateTimeFormat().resolvedOptions().timeZone` — the user's own zone.
 * - `timeZoneName: 'longOffset'` — the offset *at a given instant*, so DST is
 *   simply correct rather than approximated.
 *
 * So there is no table in this file. What there is instead is the handling for
 * three things the platform gets awkwardly right, each of which would be a
 * silent bug in a naive wrapper — see {@link ZONES}, {@link isSameZone} and
 * {@link zoneOffsetMinutes}.
 */

/**
 * Memo for {@link zoneOffsetMinutes}, declared here rather than beside it.
 *
 * `ZONES` is built at module load and reaches straight through the sort into
 * the offset lookup, so a `const` declared further down the file is still in its
 * temporal dead zone by the time the first call arrives.
 */
const OFFSET_CACHE_LIMIT = 8192
const offsetCache = new Map<string, { minutes: number | null }>()

/** A formatter that reports a zone's offset, or `null` when the zone is not real. */
function offsetFormatter(zone: string): Intl.DateTimeFormat | null {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' })
  } catch {
    // Every bad zone lands here, including `null` and a number: `Intl` throws
    // `RangeError` rather than returning anything, so this is the only way to
    // ask "is this a zone?" without a list to check against.
    return null
  }
}

/**
 * Whether the platform can use this zone at all.
 *
 * Deliberately a different question from "is it in {@link ZONES}", and the
 * distinction is the whole of problem 2 below: a zone can be perfectly usable
 * and absent from the list, and dropping it would lose the consumer's value.
 */
export function isUsableZone(zone: unknown): zone is string {
  return typeof zone === 'string' && offsetFormatter(zone) !== null
}

/** The runtime's own zone — the only sane default for an empty field. */
export function localZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    // An engine without `resolvedOptions().timeZone` is pre-2017; UTC is the
    // one answer that is never wrong, only unhelpful.
    /* v8 ignore next */
    return UTC
  }
}

/** The one zone every backend stores and the platform does not list. See {@link ZONES}. */
export const UTC = 'UTC'

/**
 * Every zone this field offers, sorted.
 *
 * **Problem 1: `UTC` is not in the platform's list.**
 * `Intl.supportedValuesOf('timeZone')` does not include `UTC`, and no zone in it
 * resolves to `UTC` either — verified against this engine. A picker built
 * straight off that array cannot select the single most commonly stored zone in
 * the world, which is a strange thing to discover in production. So it is added
 * explicitly, and sorts first.
 */
export const ZONES: readonly string[] = /* @__PURE__ */ buildZones()

function buildZones(): string[] {
  let supported: string[]
  try {
    supported = [...Intl.supportedValuesOf('timeZone')]
  } catch {
    // ES2022. An engine without it still gets a working field, just a short one.
    // Not reachable from a test: `ZONES` is built once, at module load.
    /* v8 ignore next */
    supported = []
  }
  // UTC is added here, not inside `sortZones`: that helper pins it when it is
  // present and must not invent it, because the hook uses the same sort for a
  // caller-restricted list.
  return sortZones([UTC, ...supported])
}

/**
 * Sort a set of zones the way this field shows them.
 *
 * The one place the ordering rule lives. The hook builds its own list — the
 * requested zones, plus UTC, plus whatever the consumer's value turned out to
 * be — and re-sorting that with a bare `compareZones` silently dropped the UTC
 * pin, so the rendered list opened on Pacific/Midway while `ZONES` opened on
 * UTC.
 *
 * UTC is pinned ahead of the offset order rather than sorted into it: it is the
 * most commonly stored zone in the world and it is not a place, so burying it
 * between Reykjavik and Accra helps nobody.
 */
export function sortZones(zones: readonly string[], when: Date = new Date()): string[] {
  // The instant is captured once and threaded through, for two reasons. It makes
  // the order deterministic — two comparisons in one sort can no longer straddle
  // a DST boundary — and it keeps every lookup on the same cache key, which is
  // what turns the sort from 834 formatter constructions into 419.
  const at = Number.isFinite(when.getTime()) ? when : new Date()
  const rest = [...new Set(zones)]
    .filter((zone) => zone !== UTC)
    .sort((a, b) => compareZones(a, b, at))
  return zones.includes(UTC) ? [UTC, ...rest] : rest
}

/**
 * Order two zones: by offset now, then alphabetically.
 *
 * Offset first because that is how people look for a zone — they know they want
 * "somewhere around GMT+2", not that Madrid sorts under E for Europe.
 */
export function compareZones(a: string, b: string, when: Date = new Date()): number {
  const left = zoneOffsetMinutes(a, when) ?? 0
  const right = zoneOffsetMinutes(b, when) ?? 0
  if (left !== right) return left - right
  return a < b ? -1 : a > b ? 1 : 0
}

/**
 * A zone's offset from UTC in minutes at a given instant, or `null`.
 *
 * Minutes, not hours, and that is not pedantry: Kathmandu is +05:45 and the
 * Chatham Islands are +12:45, so anything coarser cannot represent a real place.
 *
 * **The `Etc/GMT` trap.** `Etc/GMT+5` is UTC **minus** five — POSIX signs run
 * backwards. Nothing here has to special-case it, because the offset is read
 * back out of `Intl` rather than parsed from the id; a wrapper that split the id
 * on `+` would get every one of those zones backwards. None of them are in
 * {@link ZONES}, so this only matters for a value a consumer supplies, and
 * `warn.ts` says so when one arrives.
 */
export function zoneOffsetMinutes(zone: string, when: Date = new Date()): number | null {
  const stamp = when.getTime()
  if (!Number.isFinite(stamp)) return null

  // Memoised because the answer is a pure function of the pair, and the field
  // asks for it a lot: sorting 419 zones and then labelling them was 834
  // `Intl.DateTimeFormat` constructions and 65 ms of blocked main thread, every
  // time a re-render produced a new `zones` array.
  const key = `${zone}|${String(stamp)}`
  const cached = offsetCache.get(key)
  if (cached !== undefined) return cached.minutes

  const minutes = computeOffsetMinutes(zone, when)
  // A plain bound rather than an LRU: the working set is one instant's worth of
  // zones, and the only way to exceed this is to sweep many instants, at which
  // point starting over costs less than tracking recency.
  if (offsetCache.size >= OFFSET_CACHE_LIMIT) offsetCache.clear()
  offsetCache.set(key, { minutes })
  return minutes
}

function computeOffsetMinutes(zone: string, when: Date): number | null {
  const formatter = offsetFormatter(zone)
  if (formatter === null) return null

  const name = formatter.formatToParts(when).find((part) => part.type === 'timeZoneName')?.value
  /* v8 ignore next */
  if (name === undefined) return null

  // `longOffset` is `GMT+05:45`, or a bare `GMT` at zero — and, before a zone
  // adopted standard time, `GMT-00:14:44`. That seconds form is why the third
  // group is optional: without it a `referenceDate` in the 1800s made every
  // offset in the list silently `null`.
  const match = /^GMT(?:([+-])(\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(name)
  /* v8 ignore next */
  if (!match) return null
  const [, sign, hours, minutes, seconds] = match
  if (sign === undefined || hours === undefined || minutes === undefined) return 0
  const magnitude =
    Number(hours) * 60 + Number(minutes) + (seconds === undefined ? 0 : Number(seconds) / 60)
  return sign === '-' ? -magnitude : magnitude
}

/** `+05:45`, `-05:00`, `+00:00` — the offset written the way ISO 8601 writes it. */
export function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? '-' : '+'
  const total = Math.abs(minutes)
  const hours = Math.floor(total / 60)
  return `${sign}${String(hours).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/**
 * The id spelled the way *this engine* spells it, or `null` when it is not a
 * zone at all.
 *
 * **Problem 2: the engine's spelling is not your database's spelling.**
 * The tz database renames zones — `Asia/Calcutta` became `Asia/Kolkata`,
 * `Europe/Kiev` became `Europe/Kyiv` — and keeps the old name working as a link.
 * Which of the pair an engine *lists* depends on its ICU build: the one this was
 * written against lists `Asia/Calcutta` and `Europe/Kiev`, while a newer one
 * lists the modern names. Postgres, `java.time.ZoneId` and Python's `zoneinfo`
 * will hand you the modern name regardless.
 *
 * So a naive `ZONES.includes(value)` shows nothing selected for a value that is
 * perfectly correct, and which way it breaks changes with the browser.
 *
 * `resolvedOptions().timeZone` is the platform's own answer and it normalises in
 * whichever direction that engine needs — `Europe/Kyiv` → `Europe/Kiev` here,
 * `Europe/Kiev` → `Europe/Kyiv` on a newer ICU — along with the shorthands
 * (`US/Eastern` → `America/New_York`, `Japan` → `Asia/Tokyo`). It costs one call
 * and it keeps working when the tz database renames something else next year.
 *
 * A tempting wrong answer, recorded because it looked right for an hour: match
 * by *behaviour*, treating two ids as the same zone when their offsets agree at
 * a set of probe instants. It is far too coarse — five listed zones share
 * Kyiv's exact offset history (Chisinau, Kiev, Riga, Tallinn, Vilnius) — so it
 * would have quietly selected Riga for a user who meant Kyiv.
 *
 * Note this only decides which option is *selected*. A value the consumer never
 * edits is never rewritten: `onChange` fires only on a real selection.
 */
export function resolveZone(zone: unknown): string | null {
  if (!isUsableZone(zone)) return null
  let canonical: string
  try {
    canonical = new Intl.DateTimeFormat('en-US', { timeZone: zone }).resolvedOptions().timeZone
  } catch {
    // `isUsableZone` already built a formatter for this id, so reaching here
    // means the engine disagrees with itself; the id as given is the best answer.
    /* v8 ignore next */
    canonical = zone
  }
  // An offset is not a zone. See `isOffsetZone`.
  return OFFSET_ZONE.test(canonical) ? null : canonical
}

/** The shape ECMA-402 normalises an offset time zone to: `+02:00`, `-05:00`. */
const OFFSET_ZONE = /^[+-]\d{2}:\d{2}$/

/**
 * Whether the platform read this id as a bare offset rather than as a place.
 *
 * ECMA-402 accepts offset time zones, so `+02:00`, `+0200` and `+02` are all
 * valid `timeZone` values and all normalise to `+02:00`. That is a surprise
 * worth guarding, because it is exactly the mistake this component exists to
 * prevent: an offset cannot express DST, so `+02:00` is Madrid in summer and
 * wrong in winter. `Intl` finding it usable does not make it storable.
 *
 * So {@link resolveZone} refuses these and `warn.ts` explains why. Kept separate
 * from {@link isUsableZone}, which stays truthful about what the platform will
 * accept rather than about what this field will keep.
 */
export function isOffsetZone(zone: unknown): boolean {
  if (!isUsableZone(zone)) return false
  try {
    return OFFSET_ZONE.test(
      new Intl.DateTimeFormat('en-US', { timeZone: zone }).resolvedOptions().timeZone,
    )
  } catch {
    /* v8 ignore next */
    return false
  }
}

/**
 * The area an id sorts under — the part before the first slash.
 *
 * Free grouping: the ten areas are already in the id, so `<optgroup>` costs no
 * data. `UTC` has no slash and gets its own group at the top.
 */
export function zoneArea(zone: string): string {
  const slash = zone.indexOf('/')
  return slash === -1 ? zone : zone.slice(0, slash)
}

/** The city half of an id, with the underscores the tz database uses removed. */
export function zoneCity(zone: string): string {
  const slash = zone.lastIndexOf('/')
  return (slash === -1 ? zone : zone.slice(slash + 1)).replace(/_/g, ' ')
}

/** Zones grouped by area, in the order {@link compareZones} put them. */
export function groupByArea(zones: readonly string[]): { area: string; zones: string[] }[] {
  const groups: { area: string; zones: string[] }[] = []
  const index = new Map<string, { area: string; zones: string[] }>()
  for (const zone of zones) {
    const area = zoneArea(zone)
    let group = index.get(area)
    if (group === undefined) {
      group = { area, zones: [] }
      index.set(area, group)
      groups.push(group)
    }
    group.zones.push(zone)
  }
  return groups
}
