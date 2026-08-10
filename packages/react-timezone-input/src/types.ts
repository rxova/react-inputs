import type { CSSProperties, FocusEvent, ReactNode } from 'react'

/** Stable machine code for a coerced or rejected input. Safe to `switch` on. */
export type TimezoneWarningCode =
  | 'value-unknown-zone'
  | 'value-offset-not-zone'
  | 'value-etc-inverted'
  | 'zones-invalid'
  | 'zones-empty'
  | 'reference-date-invalid'
  | 'locale-invalid'

/**
 * Emitted when the component keeps itself functional despite a prop it cannot
 * use as given — a `value` that is not a zone, a `zones` list of nothing the
 * platform recognises, an `Invalid Date` as `referenceDate`. What renders is the
 * coerced result, so this is a development-only heads-up, never an error.
 */
export interface TimezoneWarning {
  code: TimezoneWarningCode
  /** The prop that carried the offending value. */
  prop: string
  /** The value as received. */
  received: string
  /** Human-readable explanation, safe to log as-is. */
  message: string
}

/** One option, for the `renderZone` render prop. */
export interface TimezoneOptionState {
  /** The IANA id, spelled the way this engine spells it. */
  zone: string
  /** The locale's name for the zone — `Central European Time`. */
  label: string
  /** The city half of the id, underscores removed. */
  city: string
  /** `+02:00` at `referenceDate`, or `null` if the engine cannot say. */
  offset: string | null
  /** Minutes from UTC at `referenceDate`, for sorting or arithmetic. */
  offsetMinutes: number | null
  /** The area this option groups under — `Europe`. */
  area: string
  /** This option is the current value. */
  selected: boolean
  /** The platform does not list this zone; it is here because it was given to us. */
  unlisted: boolean
}

export interface TimezoneInputProps {
  // ---- Value ----------------------------------------------------------------
  /**
   * Controlled value as an IANA time zone id — `"Europe/Madrid"` — or `null`
   * for empty.
   *
   * An id, never an offset. `-05:00` is New York in winter and nothing in
   * particular in summer, so an offset cannot round-trip a zone: the whole point
   * of storing `America/New_York` is that the offset is derived from it at a
   * given instant rather than frozen.
   *
   * A value spelled differently from the way this engine spells it still selects
   * the right option — `Europe/Kyiv` finds `Europe/Kiev` and vice versa,
   * through `Intl`'s own canonicalisation. A value the platform knows but does
   * not list (`US/Eastern`) is kept and shown rather than dropped.
   */
  value?: string | null
  /** Uncontrolled initial value. Ignored when `value` is given. */
  defaultValue?: string | null
  /** Fires with the selected IANA id, or `null` when the empty option is chosen. */
  onChange?: (zone: string | null) => void

  // ---- Shape ----------------------------------------------------------------
  /**
   * Restrict the list to these zones, in place of all 418 the platform knows.
   *
   * Unusable ids are dropped with a warning. `UTC` is always available: it is
   * the most commonly stored zone in the world and — verifiably —
   * `Intl.supportedValuesOf('timeZone')` does not contain it.
   */
  zones?: string[]
  /**
   * The instant the offsets are computed at.
   *
   * Offsets are a function of time, not a property of a zone: Sydney is
   * `+11:00` in January and `+10:00` in July. Pass the date your form is
   * actually about — a booking, an event — so the offsets shown are the ones
   * that will apply.
   *
   * @default the moment the field mounts, captured once. Not `new Date()` per
   * render, which would differ between server and client and would silently
   * relabel every option when a DST boundary passed with the page open.
   */
  referenceDate?: Date
  /** Group the options with `<optgroup>` by area — `Europe`, `America`. @default true */
  grouped?: boolean
  /**
   * Offer an empty option, so the field can start with nothing chosen.
   * @default true when there is no value
   */
  allowEmpty?: boolean
  /** Text for the empty option. @default 'Select a time zone' */
  placeholder?: string

  // ---- Presentation ---------------------------------------------------------
  /**
   * BCP 47 tag deciding the zone names. Presentation only — it changes no id and
   * no offset.
   * @default the runtime's locale
   */
  locale?: string
  /**
   * Custom text for one option. Must return a string: an `<option>` may contain
   * text and nothing else, which is a constraint of the element rather than of
   * this component.
   */
  renderZone?: (state: TimezoneOptionState) => string
  /** Accessible name for the field. */
  label?: ReactNode
  className?: string
  style?: CSSProperties

  // ---- Form integration -----------------------------------------------------
  /** Names the `<select>`, so a native `<form>` and `FormData` post the id. */
  name?: string
  required?: boolean
  disabled?: boolean
  /** Sets `aria-invalid` and `data-invalid`. */
  invalid?: boolean
  /** ids of external error/help text. */
  'aria-describedby'?: string
  /** Base id; the select derives `${id}-select`. */
  id?: string
  onBlur?: (event: FocusEvent<HTMLSelectElement>) => void
  onFocus?: (event: FocusEvent<HTMLSelectElement>) => void

  // ---- Diagnostics ----------------------------------------------------------
  /**
   * Called in development whenever a prop is rejected or coerced — see
   * {@link TimezoneWarning}. When omitted, the same warnings go to
   * `console.warn`. The entire path is stripped from production builds.
   */
  onWarn?: (warning: TimezoneWarning) => void
}
