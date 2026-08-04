import type { CSSProperties, FocusEvent, ReactNode } from 'react'
import type { DateParts, DateSegment } from './date'

/** Stable machine code for a coerced or rejected input. Safe to `switch` on. */
export type DateWarningCode =
  | 'value-unparseable'
  | 'value-out-of-range'
  | 'min-unparseable'
  | 'max-unparseable'
  | 'min-after-max'
  | 'locale-invalid'

/**
 * Emitted when the component keeps itself functional despite a prop it cannot
 * use as given — a `value` that is not an ISO date, a `min` after the `max`, a
 * malformed locale tag. What renders is the coerced result, so this is a
 * development-only heads-up, never an error.
 */
export interface DateWarning {
  code: DateWarningCode
  /** The prop that carried the offending value. */
  prop: string
  /** The value as received. */
  received: string
  /** Human-readable explanation, safe to log as-is. */
  message: string
}

/** Per-segment state, for the `renderSegment` render prop. */
export interface DateSegmentState {
  type: DateSegment
  /** `null` while the segment is empty. */
  value: number | null
  /** What is painted — the padded value, or the placeholder. */
  text: string
  /** This segment currently has focus. */
  focused: boolean
  min: number
  max: number
}

/** Placeholder text per segment. */
export interface DatePlaceholders {
  day?: string
  month?: string
  year?: string
}

/** Accessible names for each segment. */
export interface DateSegmentLabels {
  day?: string
  month?: string
  year?: string
}

export interface DateInputProps {
  // ---- Value ----------------------------------------------------------------
  /**
   * Controlled value as `YYYY-MM-DD`, or `null` for empty.
   *
   * A string, never a `Date`: a calendar date is not a point in time, and the
   * moment it becomes one it acquires a timezone that shifts it by a day west
   * of UTC. See the README.
   */
  value?: string | null
  /** Uncontrolled initial value as `YYYY-MM-DD`. Ignored when `value` is given. */
  defaultValue?: string | null
  /**
   * Fires when the date becomes complete and valid, and when it stops being so.
   * Never fires mid-entry with a half-typed date.
   */
  onChange?: (value: string | null) => void
  /** Fires on every keystroke, including while the date is incomplete. */
  onPartsChange?: (parts: DateParts) => void

  // ---- Range ----------------------------------------------------------------
  /** Earliest allowed date, inclusive, as `YYYY-MM-DD`. */
  min?: string
  /** Latest allowed date, inclusive, as `YYYY-MM-DD`. */
  max?: string
  /**
   * Report a completed date outside `min`/`max` through `onChange` anyway,
   * leaving the field marked invalid rather than refusing the input.
   * @default true — the alternative silently discards what the user typed.
   */
  emitOutOfRange?: boolean

  // ---- Presentation ---------------------------------------------------------
  /**
   * BCP 47 tag deciding segment order, separators and month names.
   * @default the runtime's locale
   */
  locale?: string
  /** Placeholder per segment. @default `dd` / `mm` / `yyyy` */
  placeholders?: DatePlaceholders
  /** Accessible name per segment. @default `Day` / `Month` / `Year` */
  segmentLabels?: DateSegmentLabels
  /** Custom rendering for one segment. */
  renderSegment?: (state: DateSegmentState) => ReactNode
  /** Accessible name for the whole field. */
  label?: ReactNode
  className?: string
  style?: CSSProperties

  // ---- Form integration -----------------------------------------------------
  /** Emits a hidden input carrying the ISO value, readable by a native `<form>`. */
  name?: string
  required?: boolean
  disabled?: boolean
  readOnly?: boolean
  /** Sets `aria-invalid` and `data-invalid` on the group. */
  invalid?: boolean
  /** ids of external error/help text. */
  'aria-describedby'?: string
  /** Base id; each segment derives `${id}-day`, `${id}-month`, `${id}-year`. */
  id?: string
  /** Fires when focus leaves the whole field, not when moving between segments. */
  onBlur?: (event: FocusEvent<HTMLElement>) => void
  onFocus?: (event: FocusEvent<HTMLElement>) => void

  // ---- Diagnostics ----------------------------------------------------------
  /**
   * Called in development whenever a prop is rejected or coerced — see
   * {@link DateWarning}. When omitted, the same warnings go to `console.warn`.
   * The entire path is stripped from production builds.
   */
  onWarn?: (warning: DateWarning) => void
}
