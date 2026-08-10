import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { FocusEvent } from 'react'
import {
  UTC,
  ZONES,
  groupByArea,
  localZone,
  resolveZone,
  sortZones,
  zoneArea,
  zoneCity,
  zoneOffsetMinutes,
} from './zones'
import { zoneLabel, zoneOffsetLabel } from './labels'
import { inspectLocale, inspectReferenceDate, inspectValue, inspectZones } from './warn'
import type { TimezoneOptionState, TimezoneWarning } from './types'

export interface UseTimezoneInputOptions {
  value?: string | null
  defaultValue?: string | null
  onChange?: (zone: string | null) => void
  zones?: string[]
  referenceDate?: Date
  grouped?: boolean
  allowEmpty?: boolean
  locale?: string
  disabled?: boolean
  onBlur?: (event: FocusEvent<HTMLSelectElement>) => void
  onFocus?: (event: FocusEvent<HTMLSelectElement>) => void
  onWarn?: (warning: TimezoneWarning) => void
  id?: string
}

export interface UseTimezoneInputResult {
  /** The selected IANA id, or `null`. */
  value: string | null
  /** The id spelled the way this engine spells it, which is what selects an option. */
  resolved: string | null
  /** Minutes from UTC at `referenceDate`, or `null` when nothing is selected. */
  offsetMinutes: number | null
  /** `+02:00` at `referenceDate`, or `null`. */
  offset: string | null
  /** The locale's name for the selected zone, or `null`. */
  label: string | null
  /** The instant offsets are computed at — the prop, or the mount time. */
  referenceDate: Date
  /** Every option, in display order. */
  options: TimezoneOptionState[]
  /** The same options under their areas, or one unnamed group when `grouped` is false. */
  groups: { area: string; options: TimezoneOptionState[] }[]
  /** The runtime's own zone, for a "use my zone" affordance. */
  local: string
  disabled: boolean
  ids: { root: string; select: string }
  /** Whether an empty option should be offered. */
  allowEmpty: boolean
  selectZone: (zone: string | null) => void
  handleBlur: (event: FocusEvent<HTMLSelectElement>) => void
  handleFocus: (event: FocusEvent<HTMLSelectElement>) => void
}

/**
 * Call a purely informational consumer callback without letting it break the
 * field. `onChange` is deliberately not routed through here — it is the
 * consumer's state setter, and swallowing its exception would leave the parent
 * holding a stale value with the error that explains it gone.
 */
function notify(run: () => void): void {
  try {
    run()
  } catch {
    // Intentionally swallowed; see above.
  }
}

/**
 * Headless state for a time zone field: the repaired option list, the resolved
 * selection, and the instant the offsets are read at.
 *
 * Exported so a consumer can build a searchable combobox on it — the bundled
 * renderer is a native `<select>`, which is the right default and not the only
 * possible one.
 */
export function useTimezoneInput(props: UseTimezoneInputOptions): UseTimezoneInputResult {
  const {
    value: valueProp,
    defaultValue = null,
    onChange,
    zones: zonesProp,
    referenceDate: referenceDateProp,
    grouped = true,
    allowEmpty,
    locale,
    disabled = false,
    onBlur,
    onFocus,
    onWarn,
    id: idProp,
  } = props

  const reactId = useId()
  const baseId = idProp ?? `rx-timezone-${reactId}`

  /**
   * The instant the offsets are computed at.
   *
   * Captured once per mount rather than read per render. `new Date()` in the
   * render path is two bugs at once: the server and the client would disagree,
   * which is a hydration mismatch; and every option's offset would silently
   * relabel the moment a DST boundary passed with the page open.
   */
  const [mountedAt] = useState(() => new Date())
  const referenceDate =
    referenceDateProp instanceof Date && Number.isFinite(referenceDateProp.getTime())
      ? referenceDateProp
      : mountedAt

  const isControlled = valueProp !== undefined
  const [uncontrolled, setUncontrolled] = useState<string | null>(defaultValue)
  const value = isControlled ? (valueProp ?? null) : uncontrolled

  // The engine's spelling of whatever we were given. This is what matches an
  // option, and it is why `Europe/Kyiv` selects the entry called `Europe/Kiev`.
  const resolved = useMemo(() => (value === null ? null : resolveZone(value)), [value])

  const local = useMemo(() => localZone(), [])

  /**
   * The zones on offer: the requested list or the platform's, plus UTC, plus
   * whatever the consumer's value turned out to be.
   *
   * That last part is the point. A value the engine understands but does not
   * list — `US/Eastern`, or the modern spelling on an older ICU — would
   * otherwise select nothing, and the field would look empty while holding a
   * perfectly good zone.
   */
  // Keyed on the *contents* rather than the array, because `zones={[...]}`
  // written inline is a new array on every render. Without this the list is
  // re-sorted every time the parent renders, and each sort is 419 formatter
  // calls and tens of milliseconds of blocked main thread for an identical
  // answer.
  const zonesKey = zonesProp === undefined ? '' : zonesProp.join(',')
  const referenceStamp = referenceDate.getTime()

  const list = useMemo(() => {
    // `resolveZone`, not `?? zone`: it returns null for an offset time zone, and
    // `Intl` accepts those. Keeping the fallback let `zones={['+02:00']}` put an
    // option in the list that the value path would then refuse to hold.
    const requested = zonesProp
      ?.map((zone) => resolveZone(zone))
      .filter((zone): zone is string => zone !== null)
    const base = requested !== undefined && requested.length > 0 ? requested : [...ZONES]
    if (!base.includes(UTC)) base.push(UTC)
    if (resolved !== null && !base.includes(resolved)) base.push(resolved)
    // Through the shared sort rather than a bare `compareZones`, so the UTC pin
    // survives — the requested list and the appended value both arrive
    // unordered, and re-sorting without it opened the field on Pacific/Midway.
    // Sorted at the same instant the labels use, so the order and the offsets
    // on screen cannot disagree.
    return sortZones(base, referenceDate)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on contents and instant, not identity
  }, [zonesKey, resolved, referenceStamp])

  const options = useMemo<TimezoneOptionState[]>(
    () =>
      list.map((zone) => ({
        zone,
        label: zoneLabel(zone, locale, referenceDate),
        city: zoneCity(zone),
        offset: zoneOffsetLabel(zone, referenceDate),
        offsetMinutes: zoneOffsetMinutes(zone, referenceDate),
        area: zoneArea(zone),
        selected: zone === resolved,
        unlisted: !ZONES.includes(zone),
      })),
    [list, locale, referenceDate, resolved],
  )

  const groups = useMemo(() => {
    if (!grouped) return [{ area: '', options }]
    const byZone = new Map(options.map((option) => [option.zone, option]))
    return groupByArea(list).map(({ area, zones }) => ({
      area,
      /* v8 ignore next */
      options: zones.map((zone) => byZone.get(zone)).filter((o): o is TimezoneOptionState => !!o),
    }))
  }, [grouped, options, list])

  const ids = useMemo(() => ({ root: baseId, select: `${baseId}-select` }), [baseId])

  // Development-only configuration diagnostics. Guarded so a production bundler
  // drops the branch — and with it `warn.ts` entirely. Deduped per instance so a
  // re-rendering parent warns once.
  const warned = useRef<Set<string> | null>(null)
  useEffect(() => {
    /* v8 ignore next */
    if (process.env.NODE_ENV === 'production') return
    const seen = (warned.current ??= new Set<string>())
    const emit = (warning: TimezoneWarning | null) => {
      if (!warning) return
      const key = `${warning.code}:${warning.received}`
      if (seen.has(key)) return
      seen.add(key)
      if (onWarn) {
        notify(() => {
          onWarn(warning)
        })
      }
      // Development only; this line is dropped from production builds.
      // eslint-disable-next-line no-console
      else console.warn(`[react-timezone-input] ${warning.message}`)
    }

    const raw = isControlled ? valueProp : defaultValue
    const prop = isControlled ? 'value' : 'defaultValue'
    // `raw` narrows to `string | null` here: `isControlled` is an aliased
    // condition, so TypeScript already knows `valueProp` is not `undefined` in
    // the branch that reads it.
    if (raw !== null && raw !== '') emit(inspectValue(raw, prop))
    if (zonesProp !== undefined) emit(inspectZones(zonesProp))
    if (referenceDateProp !== undefined) emit(inspectReferenceDate(referenceDateProp))
    if (locale !== undefined) emit(inspectLocale(locale))
  }, [isControlled, valueProp, defaultValue, zonesProp, referenceDateProp, locale, onWarn])

  const selectZone = useCallback(
    (zone: string | null) => {
      if (disabled) return
      if (!isControlled) setUncontrolled(zone)
      onChange?.(zone)
    },
    [disabled, isControlled, onChange],
  )

  const handleBlur = useCallback(
    (event: FocusEvent<HTMLSelectElement>) => {
      onBlur?.(event)
    },
    [onBlur],
  )

  const handleFocus = useCallback(
    (event: FocusEvent<HTMLSelectElement>) => {
      onFocus?.(event)
    },
    [onFocus],
  )

  return {
    value,
    resolved,
    offsetMinutes: resolved === null ? null : zoneOffsetMinutes(resolved, referenceDate),
    offset: resolved === null ? null : zoneOffsetLabel(resolved, referenceDate),
    label: resolved === null ? null : zoneLabel(resolved, locale, referenceDate),
    referenceDate,
    options,
    groups,
    local,
    disabled,
    ids,
    /*
     * Forced whenever nothing is selected, and only then optional.
     *
     * A native `<select>` whose `value` matches no option falls back to
     * painting its first one — so a field holding `null`, or holding a value
     * the engine cannot use, silently showed UTC and would have posted UTC
     * from a form while `onChange` had never fired. The empty option is what
     * keeps the DOM and the model agreeing.
     *
     * So `allowEmpty` means "may the user go back to empty *after* choosing",
     * which is the only part a caller has a real opinion about.
     */
    allowEmpty: resolved === null || (allowEmpty ?? false),
    selectZone,
    handleBlur,
    handleFocus,
  }
}
