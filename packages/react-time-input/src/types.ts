import type { CSSProperties, FocusEvent, ReactNode } from 'react'
import type { TimeParts, TimeSegment } from './time'

/** Stable machine code for a coerced or rejected input. Safe to `switch` on. */
export type TimeWarningCode =
  | 'value-unparseable'
  | 'value-out-of-range'
  | 'min-unparseable'
  | 'max-unparseable'
  | 'min-after-max'
  | 'locale-invalid'
  | 'step-invalid'

/**
 * Emitted when the component keeps itself functional despite a prop it cannot
 * use as given — a `value` that is not `HH:mm`, a `min` after the `max`, a step
 * that does not divide an hour. What renders is the coerced result, so this is
 * a development-only heads-up, never an error.
 */
export interface TimeWarning {
  code: TimeWarningCode
  /** The prop that carried the offending value. */
  prop: string
  /** The value as received. */
  received: string
  /** Human-readable explanation, safe to log as-is. */
  message: string
}

/** Per-segment state, for the `renderSegment` render prop. */
export interface TimeSegmentState {
  type: TimeSegment
  /** `null` while the segment is empty. For `dayPeriod`, 0 is AM and 1 is PM. */
  value: number | null
  /** What is painted — the padded value, the day-period word, or the placeholder. */
  text: string
  /** This segment currently has focus. */
  focused: boolean
  min: number
  max: number
}

/** Placeholder text per segment. */
export interface TimePlaceholders {
  hour?: string
  minute?: string
  second?: string
  dayPeriod?: string
}

/** Accessible names for each segment. */
export interface TimeSegmentLabels {
  hour?: string
  minute?: string
  second?: string
  dayPeriod?: string
}

export interface TimeInputProps {
  // ---- Value ----------------------------------------------------------------
  /**
   * Controlled value as `HH:mm` or `HH:mm:ss`, 24-hour, or `null` for empty.
   *
   * Always 24-hour whatever the field displays: one canonical format means a
   * value can be stored, compared and sorted without knowing which locale
   * produced it. A string, never a `Date` — a time of day is not an instant.
   */
  value?: string | null
  /** Uncontrolled initial value. Ignored when `value` is given. */
  defaultValue?: string | null
  /**
   * Fires when the time becomes complete and valid, and when it stops being so.
   * Never fires mid-entry with a half-typed number.
   */
  onChange?: (value: string | null) => void
  /** Fires on every keystroke, including while the time is incomplete. */
  onPartsChange?: (parts: TimeParts) => void

  // ---- Range ----------------------------------------------------------------
  /** Earliest allowed time, inclusive, as `HH:mm[:ss]`. */
  min?: string
  /** Latest allowed time, inclusive, as `HH:mm[:ss]`. */
  max?: string
  /**
   * Report a completed time outside `min`/`max` through `onChange` anyway,
   * leaving the field marked invalid rather than refusing the input.
   * @default true — the alternative silently discards what the user typed.
   */
  emitOutOfRange?: boolean

  // ---- Shape ----------------------------------------------------------------
  /** Show a seconds segment. @default false */
  showSeconds?: boolean
  /**
   * Force a 12- or 24-hour clock. @default whatever the locale uses
   */
  hour12?: boolean
  /**
   * Arrow-key step for the minute segment, in minutes. Must divide 60.
   * @default 1
   */
  minuteStep?: number
  /** Arrow-key step for the seconds segment, in seconds. Must divide 60. @default 1 */
  secondStep?: number

  // ---- Presentation ---------------------------------------------------------
  /** BCP 47 tag deciding segment order, separators and the clock. */
  locale?: string
  /** Placeholder per segment. @default `hh` / `mm` / `ss` / `--` */
  placeholders?: TimePlaceholders
  /** Accessible name per segment. @default `Hour` / `Minute` / `Second` / `AM/PM` */
  segmentLabels?: TimeSegmentLabels
  /** Custom rendering for one segment. */
  renderSegment?: (state: TimeSegmentState) => ReactNode
  /**
   * Writing direction for the field. Inherited from the document when unset.
   *
   * Distinct from the locale: `locale` decides which segments there are and in
   * what order, `dir` decides which way the box lays them out. A Hebrew page
   * showing a Gregorian date needs one without the other.
   */
  dir?: 'ltr' | 'rtl'
  /** Accessible name for the whole field. */
  label?: ReactNode
  className?: string
  style?: CSSProperties

  // ---- Form integration -----------------------------------------------------
  /** Emits a hidden input carrying the 24-hour value, readable by a native `<form>`. */
  name?: string
  required?: boolean
  disabled?: boolean
  readOnly?: boolean
  /** Sets `aria-invalid` and `data-invalid` on the group. */
  invalid?: boolean
  /** ids of external error/help text. */
  'aria-describedby'?: string
  /** Base id; each segment derives `${id}-hour`, `${id}-minute`, … */
  id?: string
  /** Fires when focus leaves the whole field, not when moving between segments. */
  onBlur?: (event: FocusEvent<HTMLElement>) => void
  onFocus?: (event: FocusEvent<HTMLElement>) => void

  // ---- Diagnostics ----------------------------------------------------------
  /**
   * Called in development whenever a prop is rejected or coerced — see
   * {@link TimeWarning}. When omitted, the same warnings go to `console.warn`.
   * The entire path is stripped from production builds.
   */
  onWarn?: (warning: TimeWarning) => void
}
