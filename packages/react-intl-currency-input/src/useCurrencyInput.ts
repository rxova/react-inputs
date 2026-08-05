import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FocusEvent, KeyboardEvent, SyntheticEvent } from 'react'
import { flushSync } from 'react-dom'
import { createCurrencyFormatter, resolveLocale } from './intl'
import { devWarnOnce } from './warn'
import type { UseCurrencyInputOptions, UseCurrencyInputResult } from './types'

/** Coerce anything to a usable amount: non-finite → null. */
function toValue(v: number | null | undefined): number | null {
  return v == null || !Number.isFinite(v) ? null : v
}

/**
 * Headless currency-input state machine.
 *
 * In `'live'` mode (the default) the field formats as you type — grouping and
 * the symbol stay visible — and the caret is kept in place by counting the
 * significant characters (digits and the decimal separator) to its left,
 * reformatting, then placing it after the same count. Because it counts *digits*
 * rather than characters, the group separators that appear and disappear never
 * move it.
 *
 * In `'blur'` mode the field shows a plain number while focused and only formats
 * on blur, so there is no caret to manage at all.
 *
 * Either way the value is the source of truth and is always a `number` (or
 * `null`); the displayed string is a view.
 */
export function useCurrencyInput(options: UseCurrencyInputOptions): UseCurrencyInputResult {
  const {
    locale,
    language,
    country,
    currency,
    value: controlledValue,
    defaultValue = null,
    onChange,
    // Reading the deprecated option is how it keeps working after the 0.2.0
    // migration; the hook is what supports it.
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    onValueChange,
    maximumFractionDigits,
    minimumFractionDigits,
    currencyDisplay,
    numberingSystem,
    allowNegative,
    step,
    transformRawValue,
    formatMode,
  } = options

  const mode = formatMode ?? 'live'
  const resolvedLocale = resolveLocale(locale, language, country)

  const formatter = useMemo(
    () =>
      createCurrencyFormatter({
        locale: resolvedLocale,
        currency,
        currencyDisplay,
        numberingSystem,
        minimumFractionDigits,
        maximumFractionDigits,
        allowNegative,
      }),
    [
      resolvedLocale,
      currency,
      currencyDisplay,
      numberingSystem,
      minimumFractionDigits,
      maximumFractionDigits,
      allowNegative,
    ],
  )

  const isControlled = controlledValue !== undefined
  const [internalValue, setInternalValue] = useState<number | null>(() => toValue(defaultValue))
  const value = isControlled ? toValue(controlledValue) : internalValue

  // `null` means "not editing" — the display then falls back to the formatted
  // value. Any string (including '') means the field is focused.
  const [editingText, setEditingText] = useState<string | null>(null)
  const focused = editingText !== null

  const inputRef = useRef<HTMLInputElement | null>(null)

  // A controlled host may echo an emitted value back asynchronously (state
  // libraries, async stores, Storybook args). Until the echo lands, the value
  // prop still holds the amount a keystroke already replaced; falling back to
  // formatting it would rewrite the field with stale text and throw the caret
  // to the end — mid-word keystrokes even get dropped. Track what was emitted
  // and which prop value the editing text was last reconciled against, so the
  // in-flight window keeps showing the user's text and only a genuine external
  // change reformats.
  const pendingEmitsRef = useRef<(number | null)[]>([])
  const reconciledValueRef = useRef<number | null>(null)

  // Set the caret imperatively while the field is focused. Called only from the
  // focused change/keydown paths, right after a synchronous (flushSync) reformat
  // so the DOM already holds `next`. No-op when the ref is not attached.
  const placeCaret = useCallback((next: string, caret: number) => {
    const el = inputRef.current
    if (!el) return
    // React skips a no-op controlled update after a rejected keystroke, so force
    // the DOM value back in sync before positioning the caret.
    /* v8 ignore next -- beforeinput now rejects the keystrokes that used to leave the DOM diverged */
    if (el.value !== next) el.value = next
    el.setSelectionRange(caret, caret)
  }, [])

  const emit = useCallback(
    (next: number | null, raw: string) => {
      const meta = { value: next, formatted: formatter.format(next), raw }
      onChange?.(next, meta)
      // The 0.2.0 rename keeps the old name working so migration can be gradual.
      // Both fire when both are given, which is what a caller migrating one call
      // site at a time would expect.
      if (onValueChange) {
        // A bundler folds this to a constant and drops the warning in a
        // production build, so the other arm is unreachable once compiled and
        // cannot be exercised by the (always-development) test build.
        /* v8 ignore next */
        if (process.env.NODE_ENV !== 'production') {
          devWarnOnce(
            'onValueChange',
            '`onValueChange` was renamed to `onChange` in 0.2.0, so this component reads like the rest of the suite. It still works. `npx @rxova/codemod currency-on-change` renames it, and moves any native change handler to `onNativeChange`.',
          )
        }
        onValueChange(next, meta)
      }
    },
    [formatter, onChange, onValueChange],
  )

  // ---- Caret math (live mode) ----------------------------------------------

  const countSignificant = useCallback(
    (s: string, upto: number): number => {
      let count = 0
      const end = Math.min(upto, s.length)
      for (let i = 0; i < end; i++) if (formatter.isSignificantChar(s.charAt(i))) count++
      return count
    },
    [formatter],
  )

  const caretForSignificant = useCallback(
    (s: string, n: number): number => {
      if (n <= 0) {
        for (let i = 0; i < s.length; i++) if (formatter.isSignificantChar(s.charAt(i))) return i
        return s.length
      }
      let count = 0
      for (let i = 0; i < s.length; i++) {
        if (formatter.isSignificantChar(s.charAt(i))) {
          count++
          if (count === n) return i + 1
        }
      }
      return s.length
    },
    [formatter],
  )

  // Reformat a just-edited string, keeping the caret anchored to the same digit.
  const applyLive = useCallback(
    (userStr: string, userCaret: number) => {
      const transformed = transformRawValue?.(userStr) ?? userStr
      const significantBefore = countSignificant(userStr, userCaret)
      const raw = formatter.extractEditing(transformed)
      const nextDisplay = formatter.formatEditing(raw)
      const nextValue = formatter.editValue(raw)
      const nextCaret = caretForSignificant(nextDisplay, significantBefore)
      // Register the emit before the flush: the reconciliation effect runs
      // inside it and must see this keystroke as in flight, not external.
      pendingEmitsRef.current.push(nextValue)
      // Commit synchronously so the DOM is reformatted before we set the caret.
      flushSync(() => {
        setEditingText(nextDisplay)
        if (!isControlled) setInternalValue(nextValue)
      })
      placeCaret(nextDisplay, nextCaret)
      emit(nextValue, formatter.editPlain(raw))
    },
    [
      transformRawValue,
      countSignificant,
      caretForSignificant,
      placeCaret,
      formatter,
      isControlled,
      emit,
    ],
  )

  // ---- Event handlers -------------------------------------------------------

  const handleFocus = useCallback(
    (event: FocusEvent<HTMLInputElement>) => {
      // Commit the editable representation before the browser continues its
      // focus action. Select-all/fill, autofill, and password-manager flows can
      // otherwise compute a selection against the previous string.
      pendingEmitsRef.current = []
      reconciledValueRef.current = value
      flushSync(() => {
        setEditingText(mode === 'live' ? formatter.format(value) : formatter.toEditable(value))
      })
      event.currentTarget.select()
    },
    [mode, formatter, value],
  )

  // Drop an insertion that could not contribute anything to the amount — a
  // letter, a group separator, or a second decimal separator. Letting it
  // through would mutate the field only for the reformat to discard it, and a
  // lagging controlled host can turn that no-op round trip into a caret jump.
  const handleBeforeInput = useCallback(
    (event: SyntheticEvent<HTMLInputElement>) => {
      if (mode !== 'live') return
      const data = (event as unknown as { data?: unknown }).data
      if (typeof data !== 'string') return
      /* v8 ignore next -- an insertion event never carries empty data */
      if (data === '') return
      const el = event.currentTarget
      /* v8 ignore next 2 -- a text input always reports numeric selection offsets */
      const start = el.selectionStart ?? el.value.length
      const end = el.selectionEnd ?? start
      const remaining = el.value.slice(0, start) + el.value.slice(end)
      const hasDecimal = remaining.includes(formatter.decimalSeparator)
      if (!formatter.insertionHasEditableChar(data, hasDecimal)) event.preventDefault()
    },
    [mode, formatter],
  )

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      if (mode === 'live') {
        const el = event.target
        applyLive(el.value, el.selectionStart ?? el.value.length)
        return
      }
      const raw = transformRawValue?.(event.target.value) ?? event.target.value
      const text = formatter.sanitize(raw)
      const next = formatter.parse(text)
      pendingEmitsRef.current.push(next)
      setEditingText(text)
      if (!isControlled) setInternalValue(next)
      emit(next, text)
    },
    [mode, applyLive, formatter, isControlled, emit, transformRawValue],
  )

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      // Backspace onto a group separator deletes the digit before it, not the
      // decorative separator (which would just reappear on reformat).
      if (
        mode === 'live' &&
        event.key === 'Backspace' &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        event.currentTarget.selectionStart === event.currentTarget.selectionEnd
      ) {
        const el = event.currentTarget
        const pos = el.selectionStart ?? 0
        if (pos > 0 && !formatter.isSignificantChar(el.value.charAt(pos - 1))) {
          let del = pos - 1
          while (del >= 0 && !formatter.isSignificantChar(el.value.charAt(del))) del--
          if (del >= 0) {
            event.preventDefault()
            applyLive(el.value.slice(0, del) + el.value.slice(pos), del)
            return
          }
        }
      }

      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
      if (step === undefined || !Number.isFinite(step) || step <= 0) return

      event.preventDefault()
      const direction = event.key === 'ArrowUp' ? 1 : -1
      const scale = 10 ** formatter.maximumFractionDigits
      const candidate = Math.round(((value ?? 0) + direction * step) * scale) / scale
      // Sanitizing a forbidden negative would drop its sign and turn an
      // ArrowDown into a positive increment. Clamp at zero before sanitizing.
      const stepped = allowNegative ? candidate : Math.max(0, candidate)
      const next = formatter.parse(formatter.sanitize(formatter.toEditable(stepped)))
      const nextText = mode === 'live' ? formatter.format(next) : formatter.toEditable(next)
      pendingEmitsRef.current.push(next)
      // A keydown reaches here only while the field is focused, so it is always
      // in editing mode — set the text unconditionally.
      flushSync(() => {
        if (!isControlled) setInternalValue(next)
        setEditingText(nextText)
      })
      if (mode === 'live') {
        placeCaret(
          nextText,
          caretForSignificant(nextText, countSignificant(nextText, nextText.length)),
        )
      }
      emit(next, nextText)
    },
    [
      mode,
      formatter,
      applyLive,
      step,
      value,
      allowNegative,
      isControlled,
      placeCaret,
      caretForSignificant,
      countSignificant,
      emit,
    ],
  )

  const handleBlur = useCallback(() => {
    // Leave editing mode; the display reverts to the formatted value.
    pendingEmitsRef.current = []
    setEditingText(null)
  }, [])

  const setValue = useCallback(
    (next: number | null) => {
      const normalized = toValue(next)
      if (!isControlled) setInternalValue(normalized)
      if (editingText !== null) {
        setEditingText(
          mode === 'live' ? formatter.format(normalized) : formatter.toEditable(normalized),
        )
      }
    },
    [isControlled, editingText, formatter, mode],
  )

  // While editing, the text state is what the user sees; when not editing the
  // display is derived from the value. Reconciling the text against a changed
  // value (or formatter) happens in the effect below, where refs are legal.
  const display = editingText ?? formatter.format(value)

  // Reconcile the in-progress text against the value prop after each commit.
  // Preserve meaningful text (a trailing `5,`) when it parses to the current
  // value or the value is merely lagging behind an emit, but derive fresh text
  // for a genuine external value, locale, or currency change.
  useEffect(() => {
    if (editingText === null) return
    if (Object.is(formatter.parse(editingText), value)) {
      reconciledValueRef.current = value
      pendingEmitsRef.current = []
      return
    }
    const echoIndex = pendingEmitsRef.current.findIndex((v) => Object.is(v, value))
    if (echoIndex !== -1) {
      // The echo of an older keystroke: newer emits are still in flight.
      pendingEmitsRef.current.splice(0, echoIndex + 1)
      reconciledValueRef.current = value
      return
    }
    if (Object.is(reconciledValueRef.current, value) && pendingEmitsRef.current.length > 0) {
      // In-flight window: the prop still holds the value a keystroke already
      // replaced. Keep the user's text; the echo will land.
      return
    }
    // External value / locale / currency change while focused.
    reconciledValueRef.current = value
    pendingEmitsRef.current = []
    setEditingText(mode === 'live' ? formatter.format(value) : formatter.toEditable(value))
  }, [editingText, value, formatter, mode])

  return {
    inputProps: {
      type: 'text',
      inputMode: 'decimal',
      autoComplete: 'off',
      value: display,
      onChange: handleChange,
      onFocus: handleFocus,
      onBlur: handleBlur,
      onKeyDown: handleKeyDown,
      onBeforeInput: handleBeforeInput,
    },
    ref: inputRef,
    value,
    display,
    focused,
    setValue,
    format: formatter.format,
    parse: formatter.parse,
    decimalSeparator: formatter.decimalSeparator,
    groupSeparator: formatter.groupSeparator,
    currencySymbol: formatter.currencySymbol,
  }
}
