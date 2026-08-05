import type { CSSProperties, FocusEvent, ReactNode } from 'react'

/** How a value snaps onto the `precision` grid. See the rounding table in the README. */
export type RatingRounding = 'nearest' | 'down' | 'up' | 'none'

/**
 * Stable machine code for a coerced input. Safe to `switch` on; the human
 * `message` on {@link RatingWarning} is for logs, this is for logic.
 */
export type RatingWarningCode =
  | 'value-non-finite'
  | 'value-negative'
  | 'value-above-max'
  | 'max-non-finite'
  | 'max-too-small'
  | 'max-non-integer'

/**
 * Emitted when the component keeps itself functional by coercing an
 * out-of-range prop — a `value` above `max`, a negative or non-finite `value`,
 * or a `max` that is not a positive integer. The coerced result (`used`) is
 * what actually renders; the warning is a development-only heads-up that the
 * input was off, never an error.
 */
export interface RatingWarning {
  code: RatingWarningCode
  /** The prop that carried the offending value. */
  prop: 'value' | 'defaultValue' | 'max'
  /** The value as received, before coercion. */
  received: number
  /** The value actually used after coercion — what gets painted. */
  used: number
  /** Human-readable explanation, safe to log as-is. */
  message: string
}

/** Per-icon state handed to an `icon` / `emptyIcon` render function. */
export interface RatingIconState {
  /** 0-based position in the row. */
  index: number
  /** Fill ratio for this icon, 0..1. */
  fill: number
  /** `fill >= 1` */
  filled: boolean
  /** `fill <= 0` */
  empty: boolean
  /** `0 < fill < 1` */
  partial: boolean
  /** A hover or keyboard preview currently covers this icon. */
  active: boolean
}

export type RatingIcon = ReactNode | ((state: RatingIconState) => ReactNode)

export interface RatingProps {
  // ---- Value ----------------------------------------------------------------
  /** Controlled score. Clamped to [0, max]; NaN/Infinity become 0. */
  value?: number
  /** Uncontrolled initial score. Ignored when `value` is provided. */
  defaultValue?: number
  /** Number of icons rendered. Positive integer. @default 5 */
  max?: number

  // ---- Rounding -------------------------------------------------------------
  /** Quantization grid: 1 = whole icons, 0.5 = halves, 0 = continuous. @default 0 */
  precision?: number
  /** Direction of the snap onto the grid. @default 'nearest' */
  rounding?: RatingRounding

  // ---- Icons ----------------------------------------------------------------
  /** Filled icon. A function receives per-icon state. @default a built-in star */
  icon?: RatingIcon
  /** Empty/track icon. @default same as `icon`, dimmed via `--rx-rating-empty-filter` */
  emptyIcon?: RatingIcon

  // ---- Interaction ----------------------------------------------------------
  /** Providing this makes the component interactive. */
  onChange?: (value: number) => void
  /** Hover/keyboard preview; `null` when the preview ends. */
  onHoverChange?: (value: number | null) => void
  /** Force read-only even when `onChange` is present. @default `!onChange` */
  readOnly?: boolean
  disabled?: boolean
  /** Re-selecting the current value clears to 0. @default true when interactive */
  allowClear?: boolean

  // ---- Form integration -----------------------------------------------------
  /** Radio group name; also emits a value readable by a native `<form>`. */
  name?: string
  required?: boolean
  /** Fires when focus leaves the whole group, not when moving between icons. */
  onBlur?: (event: FocusEvent<HTMLElement>) => void
  /** Sets `aria-invalid` and `data-invalid` on the group. */
  invalid?: boolean
  /** ids of external error/help text. */
  'aria-describedby'?: string
  /** Base id; option inputs derive `${id}-1`, `${id}-2`, ... */
  id?: string

  // ---- Presentation ---------------------------------------------------------
  /** Flips the fill origin. @default inherited from the DOM */
  dir?: 'ltr' | 'rtl'
  /** Accessible name for the group. */
  label?: string
  /** Formats the default accessible name. @default `${value} out of ${max}` */
  formatLabel?: (value: number, max: number) => string
  /** Accessible name for one option, e.g. for `aria-label` on each radio. */
  formatOptionLabel?: (value: number, max: number) => string

  className?: string
  style?: CSSProperties

  // ---- Diagnostics ----------------------------------------------------------
  /**
   * Called in development whenever a prop is coerced to keep the component
   * functional — see {@link RatingWarning}. The coerced result still renders,
   * so this never changes what the user sees; it only surfaces the mistake.
   * When omitted, the same warnings go to `console.warn`. The entire path is
   * stripped from production builds, so this is a no-op there.
   */
  onWarn?: (warning: RatingWarning) => void
}
