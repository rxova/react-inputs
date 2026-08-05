import type { CSSProperties, FocusEvent, ReactNode } from 'react'
import type { Country } from './countries'

/** Stable machine code for a coerced or rejected input. Safe to `switch` on. */
export type PhoneWarningCode =
  | 'unknown-country'
  | 'unknown-default-country'
  | 'value-not-e164'
  | 'value-country-unknown'
  | 'empty-country-list'
  | 'locale-invalid'

/**
 * Emitted when the component keeps itself functional despite a prop it cannot
 * use as given — an ISO code not in the table, a `value` that is not E.164, an
 * empty `countries` array. What renders is the coerced result, so this is a
 * development-only heads-up, never an error.
 */
export interface PhoneWarning {
  code: PhoneWarningCode
  /** The prop that carried the offending value. */
  prop: string
  /** The value as received. */
  received: string
  /** Human-readable explanation, safe to log as-is. */
  message: string
}

/** What `onChange` reports alongside the E.164 string. */
export interface PhoneDetails {
  /** `+` + calling code + national digits, or `''` while incomplete. */
  e164: string
  /** ISO 3166-1 alpha-2 of the resolved country, or `undefined`. */
  country: string | undefined
  /** National significant digits — no calling code, no trunk prefix. */
  national: string
  /**
   * The national part is a length this country actually uses.
   *
   * Deliberately named `possible`, not `valid`: without carrier assignment data
   * no client-side check can tell you a number is reachable. See the README.
   */
  possible: boolean
}

/** State handed to the `renderCountry` render prop. */
export interface PhoneCountryState {
  country: Country
  /** Localised name from `Intl.DisplayNames`. */
  name: string
  /** Flag emoji derived from the ISO code. */
  flag: string
  selected: boolean
}

export interface PhoneInputProps {
  // ---- Value ----------------------------------------------------------------
  /**
   * Controlled value in E.164 (`'+14155552671'`) or `''` for empty.
   *
   * One canonical format in and out — never the formatted display text, which
   * changes with the country and would make the value a presentation detail.
   */
  value?: string
  /** Uncontrolled initial value in E.164. Ignored when `value` is provided. */
  defaultValue?: string
  /** Fires whenever the number changes, with the E.164 string and the details. */
  onChange?: (value: string, details: PhoneDetails) => void

  // ---- Country --------------------------------------------------------------
  /** Controlled selected country, ISO 3166-1 alpha-2. */
  country?: string
  /** Initial country for the uncontrolled case. @default 'US' */
  defaultCountry?: string
  onCountryChange?: (iso2: string) => void
  /**
   * Restrict the list, in the order given. An empty array is ignored — a
   * picker with nothing in it is not a usable field.
   */
  countries?: string[]
  /** Drop the country select and require numbers to be typed in `+…` form. */
  hideCountrySelect?: boolean
  /** Accessible name for the country select. @default 'Country' */
  countryLabel?: string
  /** Custom option contents. @default flag, name and calling code */
  renderCountry?: (state: PhoneCountryState) => ReactNode
  /**
   * BCP 47 tag for country names. @default the runtime's locale
   */
  locale?: string

  // ---- Presentation ---------------------------------------------------------
  /**
   * Accessible name for the field. **Not rendered** — supply your own visible
   * `<label htmlFor={`${id}-input`}>` when the design calls for one, exactly as
   * every other input in the suite expects. A node is exposed through a hidden
   * element, since `aria-label` only takes a string.
   */
  label?: ReactNode
  placeholder?: string
  className?: string
  style?: CSSProperties

  // ---- Form integration -----------------------------------------------------
  /** Emits a hidden input carrying the E.164 value, readable by a native `<form>`. */
  name?: string
  required?: boolean
  disabled?: boolean
  readOnly?: boolean
  /**
   * Report, after the field has been left, whether the digits are a length the
   * selected country actually uses. Off by default — a form that already shows
   * its own errors does not want a second opinion inline.
   *
   * This reflects `possible`, not full validity: it catches a typo'd or
   * half-typed number, not an unassigned one. See the About page.
   * @default false
   */
  showValidity?: boolean
  /** Custom text for the {@link showValidity} message. Return `''` to say nothing. */
  validityLabel?: (state: {
    possible: boolean
    country: Country | undefined
    details: PhoneDetails
  }) => ReactNode

  /** Sets `aria-invalid` and `data-invalid`. */
  invalid?: boolean
  /** ids of external error/help text. */
  'aria-describedby'?: string
  /** Base id; the input, select and hidden field derive ids from it. */
  id?: string
  /** Fires when focus leaves the whole field, not when moving between its parts. */
  onBlur?: (event: FocusEvent<HTMLElement>) => void
  onFocus?: (event: FocusEvent<HTMLElement>) => void

  // ---- Diagnostics ----------------------------------------------------------
  /**
   * Called in development whenever a prop is rejected or coerced — see
   * {@link PhoneWarning}. When omitted, the same warnings go to `console.warn`.
   * The entire path is stripped from production builds.
   */
  onWarn?: (warning: PhoneWarning) => void
}
