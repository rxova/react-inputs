import type { CSSProperties, FocusEvent, ReactNode } from 'react'
import type { DurationParts, DurationUnit } from './duration'

/** Stable machine code for a coerced or rejected input. Safe to `switch` on. */
export type DurationWarningCode =
  | 'value-unparseable'
  | 'value-calendar-unit'
  | 'value-truncated'
  | 'value-out-of-range'
  | 'min-unparseable'
  | 'max-unparseable'
  | 'min-after-max'
  | 'units-invalid'
  | 'step-invalid'
  | 'locale-invalid'

/**
 * Emitted when the component keeps itself functional despite a prop it cannot
 * use as given — a `value` that is not an ISO 8601 duration, a `min` above the
 * `max`, a `units` array with a unit that does not exist. What renders is the
 * coerced result, so this is a development-only heads-up, never an error.
 */
export interface DurationWarning {
  code: DurationWarningCode
  /** The prop that carried the offending value. */
  prop: string
  /** The value as received. */
  received: string
  /** Human-readable explanation, safe to log as-is. */
  message: string
}

/** Per-segment state, for the `renderSegment` render prop. */
export interface DurationSegmentState {
  type: DurationUnit
  /** `null` while the segment is empty. */
  value: number | null
  /** What is painted — the padded value, or the placeholder. */
  text: string
  /** This segment currently has focus. */
  focused: boolean
  /** This is the largest unit on screen, and so is unbounded. */
  leading: boolean
  min: number
  /** `Infinity` on the leading segment, which has no natural ceiling. */
  max: number
}

/** Placeholder text per unit. */
export interface DurationPlaceholders {
  day?: string
  hour?: string
  minute?: string
  second?: string
}

/** Accessible names per unit. Overrides the locale's own words. */
export interface DurationUnitLabels {
  day?: string
  hour?: string
  minute?: string
  second?: string
}

export interface DurationInputProps {
  // ---- Value ----------------------------------------------------------------
  /**
   * Controlled value as an ISO 8601 duration — `PT1H30M`, `P2DT4H`, `PT0S` — or
   * `null` for empty.
   *
   * A string, never a number of milliseconds and never a `Date`: a duration is
   * not a point in time, and the moment it becomes one it acquires an epoch and
   * a timezone it never had. `PT1H30M` survives JSON, a database column and a
   * different language's parser without a units contract on the side.
   *
   * Unlike the date and time fields, this value does **not** sort
   * lexicographically — `'PT10M' < 'PT2H'` is true as strings and false as
   * durations. Use `compareDurations` or `toSeconds`, both exported.
   */
  value?: string | null
  /** Uncontrolled initial value as an ISO 8601 duration. Ignored when `value` is given. */
  defaultValue?: string | null
  /**
   * Fires when the duration becomes complete and valid, and when it stops being
   * so. Never fires mid-entry with a half-typed number.
   */
  onChange?: (value: string | null) => void
  /** Fires on every keystroke, including while the duration is incomplete. */
  onPartsChange?: (parts: DurationParts) => void

  // ---- Range ----------------------------------------------------------------
  /** Shortest allowed duration, inclusive, as an ISO 8601 duration. */
  min?: string
  /** Longest allowed duration, inclusive, as an ISO 8601 duration. */
  max?: string
  /**
   * Report a completed duration outside `min`/`max` through `onChange` anyway,
   * leaving the field marked invalid rather than refusing the input.
   * @default true — the alternative silently discards what the user typed.
   */
  emitOutOfRange?: boolean

  // ---- Shape ----------------------------------------------------------------
  /**
   * Which units the field edits, largest first.
   *
   * Sorted and deduped: `['minute', 'hour']` renders as hours then minutes,
   * because a duration is written largest-first everywhere and the reverse
   * would put a bounded segment in front of an unbounded one.
   *
   * The largest unit on screen is deliberately unbounded — in a minutes-only
   * field, `90` is a real ninety-minute duration. Every unit below it is
   * bounded by the one above (hours 0–23 under days, minutes and seconds 0–59)
   * and overflow carries upward on blur, so typing `90` minutes beside an hours
   * segment settles to `1h 30m`.
   *
   * @default ['hour', 'minute']
   */
  units?: DurationUnit[]
  /** Arrow-key step for the minute segment. Must divide 60. @default 1 */
  minuteStep?: number
  /** Arrow-key step for the second segment. Must divide 60. @default 1 */
  secondStep?: number

  // ---- Presentation ---------------------------------------------------------
  /**
   * BCP 47 tag deciding the unit suffixes and the segments' accessible names.
   *
   * Presentation only. Unlike the time field, the locale does not reorder
   * anything: every locale writes a duration largest-unit-first.
   *
   * @default the runtime's locale
   */
  locale?: string
  /** Placeholder per unit. @default `dd` / `hh` / `mm` / `ss` */
  placeholders?: DurationPlaceholders
  /** Accessible name per unit. @default the locale's own word for it */
  unitLabels?: DurationUnitLabels
  /** Custom rendering for one segment. */
  renderSegment?: (state: DurationSegmentState) => ReactNode
  /** Writing direction for the field. Inherited from the document when unset. */
  dir?: 'ltr' | 'rtl'
  /** Accessible name for the whole field. */
  label?: ReactNode
  className?: string
  style?: CSSProperties

  // ---- Form integration -----------------------------------------------------
  /** Emits a hidden input carrying the ISO 8601 duration, readable by a native `<form>`. */
  name?: string
  required?: boolean
  disabled?: boolean
  readOnly?: boolean
  /** Sets `aria-invalid` and `data-invalid` on the group. */
  invalid?: boolean
  /** ids of external error/help text. */
  'aria-describedby'?: string
  /** Base id; each segment derives `${id}-day`, `${id}-hour`, `${id}-minute`, … */
  id?: string
  /** Fires when focus leaves the whole field, not when moving between segments. */
  onBlur?: (event: FocusEvent<HTMLElement>) => void
  onFocus?: (event: FocusEvent<HTMLElement>) => void

  // ---- Diagnostics ----------------------------------------------------------
  /**
   * Called in development whenever a prop is rejected or coerced — see
   * {@link DurationWarning}. When omitted, the same warnings go to
   * `console.warn`. The entire path is stripped from production builds.
   */
  onWarn?: (warning: DurationWarning) => void
}
