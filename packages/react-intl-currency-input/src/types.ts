import type {
  CSSProperties,
  FocusEventHandler,
  ChangeEventHandler,
  KeyboardEventHandler,
  InputHTMLAttributes,
  SyntheticEvent,
} from 'react'

/**
 * When the field formats.
 * `'live'` (default) formats as you type — grouping and the symbol stay
 * visible, the caret stays put. `'blur'` shows a plain number while focused and
 * only formats once the field loses focus (no caret management at all).
 */
export type FormatMode = 'live' | 'blur'

/**
 * How the currency is shown. Passed straight to `Intl.NumberFormat`'s
 * `currencyDisplay`. `'symbol'` → `€`, `'narrowSymbol'` → `$` even in locales
 * that would say `US$`, `'code'` → `EUR`, `'name'` → `euros`.
 */
export type CurrencyDisplay = 'symbol' | 'narrowSymbol' | 'code' | 'name'

/**
 * The parsed value plus the two strings that produced it, handed to
 * `onChange` so a consumer never has to re-derive them.
 */
export interface CurrencyInputChange {
  /** The parsed number, or `null` when the field is empty. */
  value: number | null
  /** The fully localized string the field will show when it loses focus. */
  formatted: string
  /** The clean, separator-free editable string shown while focused. */
  raw: string
}

/** Handler for the parsed value. Shared by the hook option and the component prop. */
export type CurrencyValueChangeHandler = (value: number | null, meta: CurrencyInputChange) => void

/** Configuration shared by the hook and the component. */
export interface CurrencyInputBaseOptions {
  /**
   * BCP-47 locale, e.g. `'bg-BG'`. Takes precedence over `language`/`country`.
   * When all three are omitted the runtime default locale is used.
   */
  locale?: string
  /** Convenience: combined into `${language}-${country}` when `locale` is absent. */
  language?: string
  /** Convenience: combined into `${language}-${country}` when `locale` is absent. */
  country?: string
  /** ISO-4217 currency code, e.g. `'EUR'`, `'BGN'`, `'JPY'`. Required. */
  currency: string

  /**
   * Cap on fraction digits. Defaults to the currency's own default
   * (JPY → 0, EUR → 2, KWD → 3).
   */
  maximumFractionDigits?: number
  /** Floor on fraction digits in the formatted value. @default 0 */
  minimumFractionDigits?: number
  /** How the currency is displayed. @default 'symbol' */
  currencyDisplay?: CurrencyDisplay
  /** Override the numbering system, e.g. `'latn'` to force ASCII digits. */
  numberingSystem?: string
  /** Allow negative amounts (refunds, adjustments). @default false */
  allowNegative?: boolean
  /**
   * Amount added/subtracted by ArrowUp/ArrowDown. Omit to leave arrow keys
   * untouched. The result is rounded to the currency's fraction precision.
   */
  step?: number
  /** Transform browser input before locale-aware sanitization. */
  transformRawValue?: (raw: string) => string
  /**
   * When the field formats. `'live'` (default) formats as you type with a
   * stable caret; `'blur'` shows a plain number while focused. @default 'live'
   */
  formatMode?: FormatMode
}

/** Options for {@link useCurrencyInput}. */
export interface UseCurrencyInputOptions extends CurrencyInputBaseOptions {
  /** Controlled amount. `null`/`undefined` render an empty field, not `"0"`. */
  value?: number | null
  /** Uncontrolled initial amount. Ignored once `value` is provided. */
  defaultValue?: number | null
  /** Fires on every accepted keystroke with the parsed number (or `null`). */
  onChange?: CurrencyValueChangeHandler
  /**
   * The same handler as `onChange`.
   *
   * @deprecated Renamed to `onChange` in 0.2.0. Still fires; warns once in
   * development.
   */
  onValueChange?: CurrencyValueChangeHandler
}

/** Props to spread onto a native `<input>`. */
export interface CurrencyInputElementProps {
  type: 'text'
  inputMode: 'decimal'
  value: string
  autoComplete: string
  onChange: ChangeEventHandler<HTMLInputElement>
  onFocus: FocusEventHandler<HTMLInputElement>
  onBlur: FocusEventHandler<HTMLInputElement>
  onKeyDown: KeyboardEventHandler<HTMLInputElement>
  onBeforeInput: (event: SyntheticEvent<HTMLInputElement>) => void
}

/** Return value of {@link useCurrencyInput}. */
export interface UseCurrencyInputResult {
  /**
   * Spread these onto an `<input>`; the hook owns its value and events.
   *
   * Note the deliberate asymmetry with the options object: the *option*
   * `onChange` is the value handler, while `inputProps.onChange` here is the
   * native DOM handler you hand to the element. Different objects, different
   * jobs.
   */
  inputProps: CurrencyInputElementProps
  /**
   * Attach to the underlying `<input>`. Required in `'live'` mode so the hook
   * can keep the caret in place while it reformats; harmless otherwise.
   *
   * Typed as a plain writable ref object rather than `RefObject`/`MutableRefObject`
   * so it works across React 18 and 19: React 18's `RefObject.current` is
   * readonly (breaks the internal bridge assignment) and React 19 deprecates
   * `MutableRefObject`. A bare `{ current }` is writable and current on both.
   */
  ref: { current: HTMLInputElement | null }
  /** The current parsed value. */
  value: number | null
  /** The string the input is currently displaying. */
  display: string
  /** `true` while the field is focused (showing the editable number). */
  focused: boolean
  /** Imperatively set the value — e.g. on a form reset. */
  setValue: (value: number | null) => void
  /** Format a number the way this field would. */
  format: (value: number | null) => string
  /** Parse a string the way this field would. */
  parse: (input: string) => number | null
  /** The locale's decimal separator (e.g. `','` in de-DE). */
  decimalSeparator: string
  /** The locale's group separator (may be a non-breaking space, or `''`). */
  groupSeparator: string
  /** The resolved currency symbol/code/name for the chosen `currencyDisplay`. */
  currencySymbol: string
}

/** Props for {@link CurrencyInput}. */
export interface CurrencyInputProps
  extends
    CurrencyInputBaseOptions,
    Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'defaultValue' | 'onChange' | 'step'> {
  /** Controlled amount. `null`/`undefined` render an empty field. */
  value?: number | null
  /** Uncontrolled initial amount. */
  defaultValue?: number | null
  /**
   * Fires on every accepted keystroke with the parsed number (or `null`) and the
   * strings that produced it.
   *
   * The plain value, like every other input in the suite — see the note on
   * {@link CurrencyInputProps.onValueChange} for why this changed.
   */
  onChange?: CurrencyValueChangeHandler
  /**
   * The same handler as {@link CurrencyInputProps.onChange}.
   *
   * @deprecated Renamed to `onChange` in 0.2.0, so this component reads like the
   * rest of the suite: every `onChange` emits a plain value, never an event.
   * This one still works and still fires; it warns once in development. The raw
   * DOM event moved to `onNativeChange`. `npx @rxova/codemod currency-on-change`
   * renames both.
   */
  onValueChange?: CurrencyValueChangeHandler
  /** Marks the field invalid: sets `aria-invalid` and `data-invalid`. */
  invalid?: boolean
  /**
   * Forwarded native change handler; runs after the internal one. Rarely needed —
   * `onChange` gives you the parsed value, which is what a form wants.
   */
  onNativeChange?: ChangeEventHandler<HTMLInputElement>
  className?: string
  style?: CSSProperties
}
