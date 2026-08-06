import { useCallback, useId, useMemo, useRef, useState } from 'react'
import { useIsomorphicLayoutEffect } from './useIsomorphicLayoutEffect'
import type {
  ClipboardEvent,
  CSSProperties,
  FocusEvent,
  HTMLAttributes,
  InputHTMLAttributes,
  Ref,
  RefCallback,
  SyntheticEvent,
} from 'react'
import {
  buildSlots,
  defaultPasteTransform,
  expandOverwriteRange,
  inputModeFor,
  isComplete as computeComplete,
  normalizeLength,
  resolveIsAllowed,
  resolveMaskChar,
  sanitize,
  spliceValue,
} from './core'
import type { SelectionRange } from './core'
import type { OtpMode, OtpSlotState } from './types'

export interface UseOtpInputOptions {
  length?: number
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  onComplete?: (value: string) => void
  mode?: OtpMode
  pattern?: RegExp | string
  transform?: (value: string) => string
  pasteTransform?: (pasted: string) => string
  autoComplete?: string
  disabled?: boolean
  readOnly?: boolean
  blurOnComplete?: boolean
  mask?: boolean | string
  placeholder?: string
  name?: string
  required?: boolean
  onBlur?: (event: FocusEvent<HTMLInputElement>) => void
  invalid?: boolean
  'aria-describedby'?: string
  'aria-label'?: string
  label?: string
  id?: string
  inputRef?: Ref<HTMLInputElement>
  dir?: 'ltr' | 'rtl'
  autoFocus?: boolean
}

export interface UseOtpInputResult {
  /** The current sanitized value. */
  value: string
  /** Slot count after normalization. */
  length: number
  /** Per-slot state, in order. */
  slots: OtpSlotState[]
  /** `value.length === length`. */
  isComplete: boolean
  /** The underlying input holds focus. */
  isFocused: boolean
  /** Base id; slots derive `${baseId}-slot-0`, ... */
  baseId: string
  /**
   * Structural rather than `RefObject`: in @types/react 18 `RefObject.current`
   * is readonly, in 19 it is mutable. Declaring the shape keeps this assignable
   * under both, which matters because `react >= 18` is the peer.
   */
  inputRef: { current: HTMLInputElement | null }
  getContainerProps: (props?: HTMLAttributes<HTMLDivElement>) => HTMLAttributes<HTMLDivElement>
  getInputProps: (
    props?: InputHTMLAttributes<HTMLInputElement>,
  ) => InputHTMLAttributes<HTMLInputElement> & { ref: RefCallback<HTMLInputElement> }
  getSlotProps: (
    index: number,
    props?: HTMLAttributes<HTMLDivElement>,
  ) => HTMLAttributes<HTMLDivElement>
  /** Commit a value programmatically (sanitized like any other input). Used by WebOTP autofill. */
  setValue: (value: string) => void
  /** Reset to empty and refocus. */
  clear: () => void
  /** Focus the underlying input. */
  focus: () => void
}

/** Assign a value into a callback or object ref, tolerating either React version's shape. */
function assignRef<T>(ref: Ref<T> | undefined, value: T | null): void {
  if (typeof ref === 'function') ref(value)
  else if (ref) (ref as { current: T | null }).current = value
}

/** HTML `pattern` for the built-in modes; a custom `pattern` prop can't be safely widened to a whole-string test. */
function htmlPatternFor(mode: OtpMode, custom: RegExp | string | undefined): string | undefined {
  if (custom !== undefined) return undefined
  switch (mode) {
    case 'numeric':
      return '[0-9]*'
    case 'alpha':
      return '[A-Za-z]*'
    default:
      return '[A-Za-z0-9]*'
  }
}

/**
 * The headless state machine behind every tier of `<OtpInput>`: one real input,
 * controlled/uncontrolled value, selection tracking, paste distribution, and
 * per-slot state — with prop-getters that *merge* the caller's handlers rather
 * than clobbering them. Budgeted at about 2 kB brotli so a custom renderer pays
 * only for the logic, never the default look.
 */
export function useOtpInput(options: UseOtpInputOptions = {}): UseOtpInputResult {
  const {
    value: valueProp,
    defaultValue = '',
    onChange,
    onComplete,
    mode = 'numeric',
    pattern,
    transform,
    pasteTransform = defaultPasteTransform,
    autoComplete = 'one-time-code',
    disabled = false,
    readOnly = false,
    blurOnComplete = false,
    mask,
    placeholder,
    name,
    required,
    onBlur,
    invalid,
    'aria-describedby': describedBy,
    'aria-label': ariaLabel,
    label,
    id: idProp,
    inputRef: externalInputRef,
    dir,
    autoFocus,
  } = options

  const length = normalizeLength(options.length)
  const reactId = useId()
  const baseId = idProp ?? `rx-otp-${reactId}`

  const isAllowed = useMemo(() => resolveIsAllowed(mode, pattern), [mode, pattern])
  const maskChar = resolveMaskChar(mask)

  const isControlled = valueProp !== undefined
  const [uncontrolled, setUncontrolled] = useState(() =>
    sanitize(defaultValue, length, resolveIsAllowed(mode, pattern), transform),
  )
  const rawValue = isControlled ? valueProp : uncontrolled
  const value = useMemo(
    () => sanitize(rawValue, length, isAllowed, transform),
    [rawValue, length, isAllowed, transform],
  )

  const [selection, setSelection] = useState({ start: 0, end: 0 })
  const [isFocused, setIsFocused] = useState(false)

  const inputRef = useRef<HTMLInputElement | null>(null)
  const pendingCaretRef = useRef<number | null>(null)
  // Guards `onComplete` against firing on every keystroke while already full.
  const lastCompleteRef = useRef<string | null>(null)
  // True between compositionstart and compositionend (IME entry in progress).
  const isComposingRef = useRef(false)
  // Set on pointerdown, consumed by the focus handler: a press dispatches
  // `focus` before the browser has moved the caret under the pointer.
  const isPointerFocusRef = useRef(false)
  // Where the last press landed, for the geometric caret placement below.
  const pointerDownXRef = useRef<number | null>(null)
  // Pointer placement waits one frame for Chrome's native click caret to
  // settle. A key can arrive first under load; versioning lets keyboard input
  // cancel that stale frame instead of having it move the caret mid-code.
  const pointerSettleVersionRef = useRef(0)
  // The selection as of the previous sync — the overwrite expansion needs it
  // to tell an arrow-left collapse from an arrow-right one.
  const prevSelectionRef = useRef<SelectionRange | null>(null)

  const setRef = useCallback<RefCallback<HTMLInputElement>>(
    (node) => {
      inputRef.current = node
      assignRef(externalInputRef, node)
    },
    [externalInputRef],
  )

  const syncSelection = useCallback(
    (el: HTMLInputElement, clampEnd = false) => {
      /* v8 ignore next 2 -- a text input always reports numeric selection offsets */
      let start = el.selectionStart ?? el.value.length
      let end = el.selectionEnd ?? start
      // A full field leaves a collapsed caret with nowhere to insert, so turn
      // it into a one-character selection over its slot and let the next key
      // replace that character natively. Never while composing — moving the
      // selection under an IME cancels the composition.
      if (!isComposingRef.current) {
        const range = expandOverwriteRange(
          start,
          end,
          Array.from(el.value).length,
          length,
          prevSelectionRef.current,
          clampEnd,
        )
        if (range) {
          el.setSelectionRange(range.start, range.end)
          ;({ start, end } = range)
        }
      }
      prevSelectionRef.current = { start, end }
      setSelection((prev) => (prev.start === start && prev.end === end ? prev : { start, end }))
    },
    [length],
  )

  // The slot under (or nearest to) a viewport x, read from the rendered slot
  // rects. The browser's own click-to-caret mapping cannot be trusted here:
  // the invisible text's line box only covers part of the overlay's height
  // (a press on a slot's border maps to caret 0), the field scrolls a few
  // pixels once full (the trailing letter-spacing overflows), and separators
  // shift later slots off the uniform glyph pitch. The painted slots are the
  // ground truth the user is actually aiming at. Returns null when the
  // renderer doesn't use getSlotProps (no slot ids) — then the browser's
  // guess is all there is.
  const slotFromPointerX = useCallback(
    (clientX: number): number | null => {
      let nearest: number | null = null
      let nearestDistance = Infinity
      for (let i = 0; i < length; i++) {
        const slot = document.getElementById(`${baseId}-slot-${String(i)}`)
        if (!slot) return null
        const rect = slot.getBoundingClientRect()
        /* v8 ignore next -- a rendered slot always has layout */
        if (rect.width <= 0) return null
        const distance = Math.max(rect.left - clientX, clientX - rect.right, 0)
        if (distance === 0) return i
        if (distance < nearestDistance) {
          nearestDistance = distance
          nearest = i
        }
      }
      return nearest
    },
    [baseId, length],
  )

  // Park the caret in `slot`: collapsed at its position (clamped to the value
  // end, so a press past the filled prefix lands on the first empty slot),
  // then let the overwrite expansion turn it into a one-character selection
  // when the field is full.
  const placeCaretAtSlot = useCallback(
    (el: HTMLInputElement, slot: number) => {
      const caret = Math.min(slot, Array.from(el.value).length)
      el.setSelectionRange(caret, caret)
      // A geometric placement is not an arrow-key step: without this, a caret
      // parked at the start of the selection the click itself just produced
      // reads as an arrow-left collapse and overwrites one slot further left.
      prevSelectionRef.current = null
      syncSelection(el, true)
    },
    [syncSelection],
  )

  // A frame after a press or click, place the caret from the pointer's x —
  // the browser's own guess is wrong at the slot borders (the invisible line
  // box doesn't cover the overlay's height), off by the field's scroll once
  // full, and Chrome may still collapse the selection after the click event
  // without firing `select`. The last pending placement commits focus state
  // and falls back to the browser caret when the renderer paints no slot ids.
  const settleFromPointer = useCallback(
    (el: HTMLInputElement, x: number) => {
      const version = ++pointerSettleVersionRef.current
      requestAnimationFrame(() => {
        /* v8 ignore next -- only when the press is followed by an immediate blur or unmount */
        if (inputRef.current !== el || document.activeElement !== el) return
        if (pointerSettleVersionRef.current !== version) return
        setIsFocused(true)
        const slot = slotFromPointerX(x)
        if (slot !== null) placeCaretAtSlot(el, slot)
        else syncSelection(el, true)
      })
    },
    [slotFromPointerX, placeCaretAtSlot, syncSelection],
  )

  const interruptPointerSettle = useCallback(() => {
    pointerSettleVersionRef.current += 1
    setIsFocused(true)
  }, [])

  const commit = useCallback(
    (next: string) => {
      const sanitized = sanitize(next, length, isAllowed, transform)
      if (!isControlled) setUncontrolled(sanitized)
      onChange?.(sanitized)
      if (computeComplete(sanitized, length)) {
        if (lastCompleteRef.current !== sanitized) {
          lastCompleteRef.current = sanitized
          onComplete?.(sanitized)
          /* v8 ignore next -- input is mounted whenever a value can complete */
          if (blurOnComplete) inputRef.current?.blur()
        }
      } else {
        lastCompleteRef.current = null
      }
    },
    [length, isAllowed, transform, isControlled, onChange, onComplete, blurOnComplete],
  )

  // After a paste sets a caret target, reapply it once React has re-rendered the
  // controlled value — otherwise the native caret snaps to the end of the field.
  useIsomorphicLayoutEffect(() => {
    const caret = pendingCaretRef.current
    if (caret === null) return
    pendingCaretRef.current = null
    const el = inputRef.current
    /* v8 ignore next -- input is mounted by the time a paste sets a pending caret */
    if (!el) return
    el.setSelectionRange(caret, caret)
    syncSelection(el)
  }, [value, syncSelection])

  const handleChange = useCallback(
    (event: { currentTarget: HTMLInputElement }) => {
      // Mid-IME-composition the input holds not-yet-committed text (romaji being
      // converted, etc.). Reprocessing it here would sanitize it away and reset
      // the controlled value under the composer, cancelling the composition —
      // so wait for compositionend to commit the final result.
      if (isComposingRef.current) return
      interruptPointerSettle()
      commit(event.currentTarget.value)
      syncSelection(event.currentTarget)
    },
    [commit, syncSelection, interruptPointerSettle],
  )

  const handleCompositionStart = useCallback(() => {
    interruptPointerSettle()
    isComposingRef.current = true
  }, [interruptPointerSettle])

  const handleCompositionEnd = useCallback(
    (event: { currentTarget: HTMLInputElement }) => {
      isComposingRef.current = false
      commit(event.currentTarget.value)
      syncSelection(event.currentTarget)
    },
    [commit, syncSelection],
  )

  // A disallowed key typed over a selection would natively replace the
  // selected character and then be sanitized to nothing — a stray letter
  // deleting a digit. Drop an insertion none of whose characters survive the
  // filter before it can mutate the field. (React synthesizes `data` onto the
  // synthetic event across both of its beforeinput polyfill paths.)
  const handleBeforeInput = useCallback(
    (event: SyntheticEvent<HTMLInputElement>) => {
      /* v8 ignore next -- IME insertions surface as composition events, not a plain beforeinput, in a desktop browser */
      if (isComposingRef.current) return
      const data = (event as unknown as { data?: unknown }).data
      /* v8 ignore next -- deletions and history steps carry no data; React's polyfill only routes insertions here */
      if (typeof data !== 'string' || data === '') return
      for (const char of data) if (isAllowed(char)) return
      event.preventDefault()
    },
    [isAllowed],
  )

  const handlePaste = useCallback(
    (event: ClipboardEvent<HTMLInputElement>) => {
      event.preventDefault()
      interruptPointerSettle()
      const el = event.currentTarget
      const cleaned = pasteTransform(event.clipboardData.getData('text'))
      let insert = ''
      for (const char of cleaned) if (isAllowed(char)) insert += char
      /* v8 ignore next 2 -- a text input always reports numeric selection offsets */
      const start = el.selectionStart ?? value.length
      const end = el.selectionEnd ?? start
      const spliced = spliceValue(value, start, end, insert, length)
      commit(spliced.value)
      pendingCaretRef.current = spliced.caret
    },
    [pasteTransform, isAllowed, value, length, commit, interruptPointerSettle],
  )

  const slots = useMemo(
    () =>
      buildSlots({
        value,
        length,
        selectionStart: selection.start,
        selectionEnd: selection.end,
        isFocused,
        isDisabled: disabled,
        isReadOnly: readOnly,
        placeholder: placeholder ?? null,
        maskChar,
      }),
    [value, length, selection, isFocused, disabled, readOnly, placeholder, maskChar],
  )

  const isComplete = computeComplete(value, length)

  const clear = useCallback(() => {
    commit('')
    pendingCaretRef.current = 0
    /* v8 ignore next -- input is mounted when clear() is callable */
    inputRef.current?.focus()
  }, [commit])

  const focus = useCallback(() => {
    /* v8 ignore next -- input is mounted when focus() is callable */
    inputRef.current?.focus()
  }, [])

  const getContainerProps = useCallback<UseOtpInputResult['getContainerProps']>(
    (props = {}) => ({
      ...props,
      'data-rx-otp-root': '',
      dir,
      style: { position: 'relative', ...props.style },
    }),
    [dir],
  )

  const getInputProps = useCallback<UseOtpInputResult['getInputProps']>(
    (props = {}) => {
      // The single-input trick: the real characters and caret are invisible, so
      // the only glyphs on screen are the ones the renderer paints per slot.
      const overlayStyle: CSSProperties = {
        color: 'transparent',
        caretColor: 'transparent',
        WebkitTextFillColor: 'transparent',
        background: 'transparent',
        outline: 'none',
        ...props.style,
      }
      return {
        ...props,
        ref: setRef,
        value,
        disabled,
        readOnly,
        name,
        required,
        id: baseId,
        dir,
        autoFocus,
        inputMode: inputModeFor(mode),
        autoComplete,
        autoCapitalize: 'none',
        autoCorrect: 'off',
        spellCheck: false,
        // input-otp crashes on Chrome auto-translate because it assumes one
        // character per slot; opting the field out sidesteps the whole class.
        translate: 'no',
        pattern: htmlPatternFor(mode, pattern),
        maxLength: length,
        'aria-label': ariaLabel ?? label,
        'aria-invalid': invalid ? true : undefined,
        'aria-describedby': describedBy,
        'data-rx-otp-input': '',
        style: overlayStyle,
        onChange: (event) => {
          props.onChange?.(event)
          handleChange(event)
        },
        onBeforeInput: (event) => {
          props.onBeforeInput?.(event)
          handleBeforeInput(event)
        },
        onPaste: (event) => {
          props.onPaste?.(event)
          handlePaste(event)
        },
        onCompositionStart: (event) => {
          props.onCompositionStart?.(event)
          handleCompositionStart()
        },
        onCompositionEnd: (event) => {
          props.onCompositionEnd?.(event)
          handleCompositionEnd(event)
        },
        onPointerDown: (event) => {
          props.onPointerDown?.(event)
          isPointerFocusRef.current = true
          pointerDownXRef.current = event.clientX
          // A press moves the caret somewhere unrelated to the previous
          // selection; forget it so the overwrite expansion can't mistake the
          // landing for an arrow-key step.
          prevSelectionRef.current = null
        },
        onKeyDown: (event) => {
          props.onKeyDown?.(event)
          interruptPointerSettle()
        },
        onFocus: (event) => {
          props.onFocus?.(event)
          const el = event.currentTarget
          if (isPointerFocusRef.current) {
            isPointerFocusRef.current = false
            // On a pointer press the selection read here is still the previous
            // one (the caret lands after the focus event), so committing now
            // would flash a stale slot active before the pressed one. Wait a
            // frame for the caret, then commit focus + selection in one render
            // — placed from the press's own x, not the browser's guess.
            /* v8 ignore next -- pointerdown always records its x before focus can see the flag */
            settleFromPointer(el, pointerDownXRef.current ?? 0)
          } else {
            // Keyboard/programmatic focus: browsers land the caret wherever
            // they please (select-all, a restored range, position 0). Park it
            // deterministically at the first empty slot — or over the last
            // character when the code is full, so typing overwrites it.
            const valueEnd = el.value.length
            el.setSelectionRange(Math.min(valueEnd, length - 1), valueEnd)
            setIsFocused(true)
            syncSelection(el)
          }
        },
        onBlur: (event) => {
          props.onBlur?.(event)
          setIsFocused(false)
          onBlur?.(event)
        },
        onSelect: (event) => {
          props.onSelect?.(event)
          syncSelection(event.currentTarget)
        },
        onKeyUp: (event) => {
          props.onKeyUp?.(event)
          syncSelection(event.currentTarget)
        },
        onClick: (event) => {
          props.onClick?.(event)
          // A press on an already-focused field fires no focus event; drop the
          // pointer flag here so a later keyboard focus stays synchronous.
          isPointerFocusRef.current = false
          const el = event.currentTarget
          syncSelection(el, true)
          // Only a genuine click settles geometrically: detail is 0 for a
          // programmatic el.click() (no pointer to trust), and a press that
          // travelled is a drag selection that must stay untouched.
          const downX = pointerDownXRef.current
          if (event.detail === 0 || downX === null || Math.abs(event.clientX - downX) > 5) return
          settleFromPointer(el, event.clientX)
        },
      }
    },
    [
      setRef,
      value,
      disabled,
      readOnly,
      name,
      required,
      baseId,
      dir,
      autoFocus,
      mode,
      autoComplete,
      pattern,
      length,
      ariaLabel,
      label,
      invalid,
      describedBy,
      handleChange,
      handleBeforeInput,
      handlePaste,
      handleCompositionStart,
      handleCompositionEnd,
      interruptPointerSettle,
      syncSelection,
      settleFromPointer,
      onBlur,
    ],
  )

  const getSlotProps = useCallback<UseOtpInputResult['getSlotProps']>(
    (index, props = {}) => {
      const slot = slots[index]
      const state = slot?.isActive ? 'active' : slot?.isFilled ? 'filled' : 'empty'
      return {
        ...props,
        id: `${baseId}-slot-${String(index)}`,
        'aria-hidden': true,
        'data-rx-otp-slot': '',
        'data-state': state,
        ...(slot?.isActive ? { 'data-active': '' } : {}),
        ...(slot?.isFilled ? { 'data-filled': '' } : {}),
        ...(disabled ? { 'data-disabled': '' } : {}),
        ...(readOnly ? { 'data-readonly': '' } : {}),
        ...(invalid ? { 'data-invalid': '' } : {}),
      }
    },
    [slots, baseId, disabled, readOnly, invalid],
  )

  return {
    value,
    length,
    slots,
    isComplete,
    isFocused,
    baseId,
    inputRef,
    getContainerProps,
    getInputProps,
    getSlotProps,
    setValue: commit,
    clear,
    focus,
  }
}
