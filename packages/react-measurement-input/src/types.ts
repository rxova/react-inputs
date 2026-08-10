import type { CSSProperties, FocusEvent, ReactNode } from 'react'
import type { MeasurementParts, MeasurementUnit } from './units'

/** Stable machine code for a coerced or rejected input. Safe to `switch` on. */
export type MeasurementWarningCode =
  | 'value-unparseable'
  | 'value-unknown-unit'
  | 'value-time-unit'
  | 'value-no-partner'
  | 'value-dimension-mismatch'
  | 'value-truncated'
  | 'value-out-of-range'
  | 'min-unparseable'
  | 'max-unparseable'
  | 'min-after-max'
  | 'units-invalid'
  | 'units-not-convertible'
  | 'units-dimension-mixed'
  | 'units-ratio-not-integer'
  | 'units-temperature-multi'
  | 'precision-invalid'
  | 'step-invalid'
  | 'locale-invalid'

/**
 * Emitted when the component keeps itself functional despite a prop it cannot
 * use as given — a `value` in a unit this field does not show, a `units` array
 * mixing metres and pounds, a pair of units with no whole-number ratio between
 * them. What renders is the coerced result, so this is a development-only
 * heads-up, never an error.
 */
export interface MeasurementWarning {
  code: MeasurementWarningCode
  /** The prop that carried the offending value. */
  prop: string
  /** The value as received. */
  received: string
  /** Human-readable explanation, safe to log as-is. */
  message: string
}

/** Per-segment state, for the `renderSegment` render prop. */
export interface MeasurementSegmentState {
  type: MeasurementUnit
  /** `null` while the segment is empty. */
  value: number | null
  /** What is painted — the value being typed, the formatted value, or the placeholder. */
  text: string
  /** This segment currently has focus. */
  focused: boolean
  /** This is the largest unit on screen, and so is unbounded. */
  leading: boolean
  /** This is the smallest unit on screen, and so is the one that may carry decimals. */
  trailing: boolean
  /** `-Infinity` on a temperature field's segment, which has no floor. */
  min: number
  /** `Infinity` on the leading segment, which has no natural ceiling. */
  max: number
  /** Decimal places this segment accepts. Zero on every segment but the last. */
  precision: number
}

/** Placeholder text per unit. Anything not named falls back to dashes. */
export type MeasurementPlaceholders = Partial<Record<MeasurementUnit, string>>

/** Accessible names per unit. Overrides the locale's own words. */
export type MeasurementUnitLabels = Partial<Record<MeasurementUnit, string>>

export interface MeasurementInputProps {
  // ---- Value ----------------------------------------------------------------
  /**
   * Controlled value as `"<amount> <unit>"` — `"71 inch"`, `"180 centimeter"`,
   * `"36.6 celsius"` — or `null` for empty.
   *
   * One self-describing string rather than a bare number, for the same reason
   * the duration field emits `PT1H30M`: a number needs a units contract
   * travelling beside it, and that contract is where the bugs live. The unit
   * half is an `Intl` unit identifier verbatim, so nothing new is invented.
   *
   * It is emitted in the **smallest unit on screen**, never converted to a base
   * unit. One foot in metres is `0.30479999999999996` in binary floating point,
   * so normalising would write float noise into the canonical value; `"12 inch"`
   * is exact.
   *
   * The consequence, stated rather than hidden: **two equal measurements are not
   * `===` equal.** `"71 inch"` and `"1.8034 meter"` are the same height. Use
   * `compareMeasurements` or `toBaseUnit`, both exported.
   */
  value?: string | null
  /** Uncontrolled initial value as `"<amount> <unit>"`. Ignored when `value` is given. */
  defaultValue?: string | null
  /**
   * Fires when the measurement becomes complete, and when it stops being so.
   * Never fires mid-entry with a half-typed number.
   */
  onChange?: (value: string | null) => void
  /** Fires on every keystroke, including while the measurement is incomplete. */
  onPartsChange?: (parts: MeasurementParts) => void

  // ---- Range ----------------------------------------------------------------
  /**
   * Smallest allowed measurement, inclusive, as `"<amount> <unit>"`. It does not
   * have to be in a unit the field shows — `min="1 meter"` bounds a
   * feet-and-inches field correctly.
   */
  min?: string
  /** Largest allowed measurement, inclusive, as `"<amount> <unit>"`. */
  max?: string
  /**
   * Report a completed measurement outside `min`/`max` through `onChange`
   * anyway, leaving the field marked invalid rather than refusing the input.
   * @default true — the alternative silently discards what the user typed.
   */
  emitOutOfRange?: boolean

  // ---- Shape ----------------------------------------------------------------
  /**
   * Which units the field edits, largest first.
   *
   * Every unit is an `Intl` unit identifier. They must all belong to one
   * dimension, and **each adjacent pair must divide exactly**: `['foot',
   * 'inch']` works because a foot is twelve inches, `['meter', 'inch']` does not
   * because a metre is 39.37 of them — a segment whose overflow point falls
   * mid-unit is not a segment, so the pair collapses to `['meter']` with a
   * warning.
   *
   * The largest unit on screen is deliberately unbounded — in a
   * centimetres-only field, `180` is a real height. Every unit below it is
   * bounded by its ratio to the one above, and overflow carries upward on blur,
   * so typing `14` inches beside a feet segment settles to `1 ft 2 in`.
   *
   * Time units are refused: `day`, `hour`, `minute` and the rest belong to
   * `@rxova/react-duration-input`. So are `percent` and `degree`, which have no
   * conversion partner in `Intl`'s list.
   *
   * Temperature is single-unit: `3 °C 20 °F` is not a temperature.
   *
   * @default ['meter', 'centimeter']
   */
  units?: MeasurementUnit[]
  /**
   * Decimal places the **smallest** segment accepts, 0 to 6.
   *
   * Only the smallest, because a fractional foot beside an inches segment is
   * the same number written twice. A temperature field wants `1`; a
   * feet-and-inches field wants `0`.
   *
   * @default 0
   */
  precision?: number
  /**
   * Arrow-key step for the smallest segment. Every other segment steps by one.
   * @default one unit of `precision` — `1`, or `0.1` at one decimal place
   */
  step?: number

  // ---- Presentation ---------------------------------------------------------
  /**
   * BCP 47 tag deciding the unit suffixes and the segments' accessible names.
   *
   * Presentation only — it changes no arithmetic and reorders nothing, because
   * every locale writes a measurement largest-unit-first.
   *
   * @default the runtime's locale
   */
  locale?: string
  /** Placeholder per unit. @default dashes, one per digit the segment holds */
  placeholders?: MeasurementPlaceholders
  /** Accessible name per unit. @default the locale's own word for it */
  unitLabels?: MeasurementUnitLabels
  /** Custom rendering for one segment. */
  renderSegment?: (state: MeasurementSegmentState) => ReactNode
  /** Writing direction for the field. Inherited from the document when unset. */
  dir?: 'ltr' | 'rtl'
  /** Accessible name for the whole field. */
  label?: ReactNode
  className?: string
  style?: CSSProperties

  // ---- Form integration -----------------------------------------------------
  /** Emits a hidden input carrying `"<amount> <unit>"`, readable by a native `<form>`. */
  name?: string
  required?: boolean
  disabled?: boolean
  readOnly?: boolean
  /** Sets `aria-invalid` and `data-invalid` on the group. */
  invalid?: boolean
  /** ids of external error/help text. */
  'aria-describedby'?: string
  /** Base id; each segment derives `${id}-foot`, `${id}-inch`, … */
  id?: string
  /** Fires when focus leaves the whole field, not when moving between segments. */
  onBlur?: (event: FocusEvent<HTMLElement>) => void
  onFocus?: (event: FocusEvent<HTMLElement>) => void

  // ---- Diagnostics ----------------------------------------------------------
  /**
   * Called in development whenever a prop is rejected or coerced — see
   * {@link MeasurementWarning}. When omitted, the same warnings go to
   * `console.warn`. The entire path is stripped from production builds.
   */
  onWarn?: (warning: MeasurementWarning) => void
}
