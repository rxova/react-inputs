import type { CSSProperties, FocusEvent, ReactNode, Ref } from 'react'

/** Character class the field accepts. Drives `inputMode`, `pattern`, `autoCapitalize`. */
export type OtpMode = 'numeric' | 'alphanumeric' | 'alpha'

/** How to lay the real input over the slots. See the architecture section of the README. */
export type OtpSlotInteraction = 'spatial' | 'crush'

/**
 * Per-slot state handed to `<OtpSlot>` (via context), to the `render` prop, and
 * returned by the hook as `slots`. The analogue of `RatingIconState` in the
 * sibling repo — a plain, serializable description of one slot, no handlers.
 */
export interface OtpSlotState {
  /** 0-based position in the row. */
  index: number
  /** The character in this slot, or `null` when empty. Already masked when `mask` is set. */
  char: string | null
  /** `char !== null` */
  isFilled: boolean
  /** The caret is at this slot, or a selection covers it. */
  isActive: boolean
  /** Render the blinking caret here. */
  hasFakeCaret: boolean
  /** Placeholder char for this slot, or `null`. */
  placeholder: string | null
  isDisabled: boolean
  isReadOnly: boolean
}

/** Context passed to the Tier-3 `render` prop. */
export interface OtpRenderContext {
  /** One entry per slot, in order. */
  slots: OtpSlotState[]
  /** The current sanitized value. */
  value: string
  /** `value.length === length`. */
  isComplete: boolean
  /** The underlying input currently holds focus. */
  isFocused: boolean
}

export interface OtpInputProps {
  // ---- Value ----------------------------------------------------------------
  /** Number of slots. Positive integer. @default 6 */
  length?: number
  /** Controlled value. Sanitized to allowed chars and clamped to `length`; never throws. */
  value?: string
  /** Uncontrolled initial value. Ignored when `value` is provided. */
  defaultValue?: string
  /** Emits the sanitized **string** (not an event). */
  onChange?: (value: string) => void
  /**
   * Fires once the value reaches `length`. The only completion hook — the
   * library never calls `form.requestSubmit()` for you; wire submit/verify here.
   */
  onComplete?: (value: string) => void

  // ---- Character rules ------------------------------------------------------
  /** Drives inputMode, pattern, autoCapitalize. @default 'numeric' */
  mode?: OtpMode
  /** Override the allowed-character test (per char). Beats `mode` when set. */
  pattern?: RegExp | string
  /** Normalize each committed value (e.g. `s => s.toUpperCase()`). Applied after `pattern`. */
  transform?: (value: string) => string
  /** Clean pasted text before distributing. @default strips whitespace and `- . _` separators */
  pasteTransform?: (pasted: string) => string

  // ---- Autofill / SMS -------------------------------------------------------
  /** The attribute that unlocks iOS/Android SMS suggestions. @default 'one-time-code' */
  autoComplete?: string
  /**
   * Opt into the WebOTP API (Android Chrome): programmatic SMS retrieval +
   * AbortController cleanup. Layered on top of `autocomplete`, never instead of
   * it. @default false
   */
  webOTP?: boolean

  // ---- Interaction ----------------------------------------------------------
  disabled?: boolean
  readOnly?: boolean
  autoFocus?: boolean
  /** Blur the input once complete (dismisses the mobile keyboard). @default false */
  blurOnComplete?: boolean
  /**
   * 'spatial' = tap any slot to edit it (auto-degrades to 'crush' on iOS, which
   * cannot fully hide `::selection`); keyboard input always takes precedence over
   * deferred pointer placement. 'crush' = collapsed-input behaviour everywhere.
   * @default 'spatial'
   */
  slotInteraction?: OtpSlotInteraction
  /** Render a mask char instead of the value (sensitive codes). `true` -> '•'. */
  mask?: boolean | string
  /** Per-slot placeholder shown while empty. */
  placeholder?: string

  // ---- Form integration -----------------------------------------------------
  /** Posts natively in a `<form>` and is the name RHF/Formik bind to. */
  name?: string
  required?: boolean
  /** Fires when focus leaves the whole control, never between slots. */
  onBlur?: (event: FocusEvent<HTMLInputElement>) => void
  /** Sets `aria-invalid` and `data-invalid`. */
  invalid?: boolean
  /** id(s) of external error/help text. */
  'aria-describedby'?: string
  /** Accessible name for the field. */
  label?: string
  'aria-label'?: string
  /** Base id; slots derive `${id}-slot-0`, ... */
  id?: string
  /** Ref to the underlying `<input>`. */
  inputRef?: Ref<HTMLInputElement>

  // ---- Presentation ---------------------------------------------------------
  dir?: 'ltr' | 'rtl'
  /** CSP nonce applied to any injected style. */
  nonce?: string
  className?: string
  style?: CSSProperties
  /** Tier 3 escape hatch. Ignored when children are provided. */
  render?: (ctx: OtpRenderContext) => ReactNode
  children?: ReactNode
}
