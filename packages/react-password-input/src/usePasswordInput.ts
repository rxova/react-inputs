import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { FocusEvent, KeyboardEvent, MouseEvent } from 'react'
import { estimateStrength } from './strength'
import { defaultRules, evaluateRules, rulesSatisfied } from './rules'
import {
  inspectAutoComplete,
  inspectEstimate,
  inspectMaxLength,
  inspectMinLength,
  inspectRuleIds,
} from './warn'
import { useIsomorphicLayoutEffect } from './useIsomorphicLayoutEffect'
import type {
  PasswordRule,
  PasswordRuleState,
  PasswordScore,
  PasswordStrength,
  PasswordWarning,
} from './types'

const DEFAULT_MIN_LENGTH = 8
const DEFAULT_CHECK_DELAY = 400

/**
 * The caret range, as a plain pair.
 *
 * `selectionStart`/`selectionEnd` are typed `number | null` because they *are*
 * null on input types with no selection model — `email`, `number`, `checkbox`.
 * This component only ever renders `text` or `password`, both of which always
 * report numbers, so the null arms are unreachable rather than untested. They
 * are excluded from coverage instead of being "covered" by a test that would
 * have to render an input type the component cannot produce.
 */
/* v8 ignore next 3 */
function readSelection(input: HTMLInputElement): [number, number] {
  return [input.selectionStart ?? 0, input.selectionEnd ?? 0]
}

export interface UsePasswordInputOptions {
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  revealed?: boolean
  defaultRevealed?: boolean
  onRevealChange?: (revealed: boolean) => void
  hideOnBlur?: boolean
  estimate?: (password: string) => PasswordStrength
  blocklist?: string[]
  userInputs?: string[]
  minScore?: PasswordScore | null
  rules?: PasswordRule[]
  minLength?: number
  maxLength?: number
  onValidityChange?: (valid: boolean) => void
  capsLockWarning?: boolean
  checkCompromised?: (password: string, signal: AbortSignal) => Promise<boolean>
  checkCompromisedDelay?: number
  disabled?: boolean
  readOnly?: boolean
  autoComplete?: string
  onBlur?: (event: FocusEvent<HTMLElement>) => void
  onFocus?: (event: FocusEvent<HTMLElement>) => void
  onWarn?: (warning: PasswordWarning) => void
  id?: string
}

export interface UsePasswordInputResult {
  /** The current password. */
  value: string
  /** The password is currently rendered as plain text. */
  revealed: boolean
  /** `'text'` when revealed, `'password'` otherwise. */
  type: 'text' | 'password'
  /** Caps Lock is on and `capsLockWarning` is enabled. */
  capsLock: boolean
  /** The estimator's verdict for the current password. */
  strength: PasswordStrength
  /** Every rule with its `met` flag. */
  rules: PasswordRuleState[]
  /** `true` / `false` once `checkCompromised` resolves, `null` before that. */
  compromised: boolean | null
  /** A `checkCompromised` call is in flight. */
  checking: boolean
  /** All required rules met, `minScore` reached, and not known-compromised. */
  valid: boolean
  /** `minLength` after coercion — also what the default length rule uses. */
  minLength: number
  /** `maxLength` after coercion, or `undefined` when unset or unusable. */
  maxLength: number | undefined
  disabled: boolean
  /** Stable ids for the input and each piece of describing text. */
  ids: {
    input: string
    /** Only referenced when `label` is a node rather than a string. */
    label: string
    strength: string
    rules: string
    capsLock: string
    compromised: string
    announcement: string
  }
  /**
   * Structural rather than `RefObject`: in @types/react 18 `RefObject.current`
   * is readonly, in 19 it is mutable. Declaring the shape keeps this assignable
   * under both, which matters because `react >= 18` is a peer.
   */
  inputRef: { current: HTMLInputElement | null }
  setValue: (next: string) => void
  /** Empty the field. Present on every input hook in the suite. */
  clear: () => void
  setRevealed: (next: boolean) => void
  toggleReveal: () => void
  /** Wire to the toggle's `onMouseDown` so the caret survives the reveal. */
  captureSelection: () => void
  /** Wire to the input's `onKeyDown`/`onKeyUp` to keep the Caps Lock flag live. */
  handleModifierEvent: (event: KeyboardEvent<HTMLElement> | MouseEvent<HTMLElement>) => void
  handleBlur: (event: FocusEvent<HTMLElement>) => void
  handleFocus: (event: FocusEvent<HTMLElement>) => void
}

/**
 * Headless state for a password field: value, reveal, Caps Lock, strength,
 * rules, and the debounced breach check. Exported so a consumer can build a
 * completely custom renderer without reimplementing the fiddly parts — caret
 * restoration across a `type` swap and abortable async checks especially.
 */
export function usePasswordInput(options: UsePasswordInputOptions): UsePasswordInputResult {
  const {
    value: valueProp,
    defaultValue = '',
    onChange,
    revealed: revealedProp,
    defaultRevealed = false,
    onRevealChange,
    hideOnBlur = true,
    estimate,
    blocklist,
    userInputs,
    minScore = null,
    rules: rulesProp,
    minLength: minLengthProp = DEFAULT_MIN_LENGTH,
    maxLength: maxLengthProp,
    onValidityChange,
    capsLockWarning = true,
    checkCompromised,
    checkCompromisedDelay = DEFAULT_CHECK_DELAY,
    disabled = false,
    readOnly = false,
    autoComplete = 'current-password',
    onBlur,
    onFocus,
    onWarn,
    id: idProp,
  } = options

  const reactId = useId()
  const baseId = idProp ?? `rx-password-${reactId}`

  const isControlled = valueProp !== undefined
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue)
  const value = isControlled ? valueProp : uncontrolledValue

  const isRevealControlled = revealedProp !== undefined
  const [uncontrolledRevealed, setUncontrolledRevealed] = useState(defaultRevealed)
  const revealed = isRevealControlled ? revealedProp : uncontrolledRevealed

  const [capsLock, setCapsLock] = useState(false)

  /**
   * The breach verdict, stamped with the password it belongs to, and the
   * password a lookup is currently in flight for.
   *
   * Both are *derived* rather than reset: a verdict only applies while the
   * field still holds the password it was computed for. That makes the stale-
   * response race structurally impossible instead of merely guarded against,
   * and it means the effect never has to call setState synchronously to clear
   * anything when the password changes.
   */
  const [result, setResult] = useState<{ value: string; compromised: boolean } | null>(null)
  const [pending, setPending] = useState<string | null>(null)

  const compromised = result !== null && result.value === value ? result.compromised : null
  const checking = pending !== null && pending === value

  const inputRef = useRef<HTMLInputElement | null>(null)
  // Set by toggleReveal, consumed by the layout effect below. A ref rather than
  // state because restoring the caret must not itself cause a render.
  const pendingSelection = useRef<[number, number] | null>(null)
  // The last selection the *input* reported, which is not the same as the
  // selection at the moment the toggle is clicked — see `trackSelection`.
  const lastSelection = useRef<[number, number] | null>(null)

  const minLength =
    Number.isFinite(minLengthProp) && minLengthProp >= 0
      ? Math.floor(minLengthProp)
      : DEFAULT_MIN_LENGTH
  // A maxLength under the minimum is unsatisfiable, so it is dropped rather
  // than enforced — a field nobody can fill is worse than a missing cap.
  const maxLength =
    maxLengthProp !== undefined && maxLengthProp >= minLength ? maxLengthProp : undefined

  const rules = useMemo(() => rulesProp ?? defaultRules(minLength), [rulesProp, minLength])

  /**
   * `blocklist` and `userInputs` are almost always written as inline array
   * literals, which are a fresh reference on every render. Memoising the
   * estimate on those references means it recomputes whenever the *parent*
   * re-renders for an unrelated reason — and with a zxcvbn adapter plugged into
   * `estimate`, that is a multi-millisecond cost per unrelated update.
   *
   * Joining the entries gives a value-equal key, and the memo rebuilds the
   * arrays from the key rather than closing over the originals — so the
   * dependency list is honest and no lint rule has to be silenced.
   */
  const blocklistKey = (blocklist ?? []).join('\u0000')
  const userInputsKey = (userInputs ?? []).join('\u0000')

  const { strength, estimateThrew } = useMemo(() => {
    const fallback = () =>
      estimateStrength(value, {
        blocklist: blocklistKey === '' ? undefined : blocklistKey.split('\u0000'),
        userInputs: userInputsKey === '' ? undefined : userInputsKey.split('\u0000'),
        minLength,
      })

    if (!estimate) return { strength: fallback(), estimateThrew: false }

    // `estimate` is consumer code running on every keystroke, exactly like a
    // rule predicate. A throwing adapter degrades the meter to the built-in
    // estimate; it does not take the login form down.
    try {
      return { strength: estimate(value), estimateThrew: false }
    } catch {
      return { strength: fallback(), estimateThrew: true }
    }
  }, [estimate, value, blocklistKey, userInputsKey, minLength])

  const ruleStates = useMemo(() => evaluateRules(rules, value), [rules, value])

  const valid =
    rulesSatisfied(ruleStates) &&
    (minScore === null || strength.score >= minScore) &&
    compromised !== true

  // Fires on transitions only. Calling it every render would make the obvious
  // `onValidityChange={setValid}` wiring an infinite loop.
  const lastValid = useRef<boolean | null>(null)
  useEffect(() => {
    if (lastValid.current === valid) return
    lastValid.current = valid
    onValidityChange?.(valid)
  }, [valid, onValidityChange])

  /**
   * Debounced, abortable breach check.
   *
   * Re-runs whenever the password changes; the previous request is aborted, so
   * a slow response for an old password can never overwrite the verdict for the
   * current one. The library issues no request of its own — `checkCompromised`
   * is entirely the consumer's, which is what keeps the plaintext local.
   */
  useEffect(() => {
    // Skipped while disabled: a disabled field is not being edited by anyone,
    // so handing its contents to an outbound callback is work — and an
    // exposure — the user never asked for.
    //
    // No state is reset here. Both `compromised` and `checking` are *derived*
    // from the password the answer belongs to, so a verdict for a password that
    // is no longer in the field simply stops applying — there is nothing to
    // clear, and the effect never calls setState synchronously.
    if (!checkCompromised || value === '' || disabled) return

    const controller = new AbortController()
    let cancelled = false
    const timer = setTimeout(() => {
      setPending(value)
      // `Promise.resolve().then(...)` around the call, not just `.then` on its
      // result: a callback that throws before returning — or returns something
      // that is not a promise at all — would otherwise throw synchronously
      // inside a timer, which React surfaces as an unrecoverable error rather
      // than a failed lookup.
      Promise.resolve()
        .then(() => checkCompromised(value, controller.signal))
        .then((compromised) => {
          if (!cancelled) setResult({ value, compromised })
        })
        .catch(() => {
          // A failed or aborted lookup is not evidence of anything. Reporting
          // `false` here would tell the user their password is fine because the
          // network was down.
          if (!cancelled) setResult(null)
        })
        .finally(() => {
          if (!cancelled) setPending(null)
        })
    }, checkCompromisedDelay)

    return () => {
      cancelled = true
      clearTimeout(timer)
      controller.abort()
    }
  }, [checkCompromised, checkCompromisedDelay, value, disabled])

  // Development-only configuration diagnostics. Guarded so a production bundler
  // drops the branch — and with it `warn.ts` entirely. Deduped per instance so
  // a re-rendering parent warns once, not once per keystroke.
  const warnedRef = useRef<Set<string> | null>(null)
  useEffect(() => {
    // A bundler folds this to a constant and drops the whole effect body in a
    // production build, so the branch is unreachable once compiled and cannot
    // be exercised by the (always-development) test build.
    /* v8 ignore next */
    if (process.env.NODE_ENV === 'production') return
    const seen = (warnedRef.current ??= new Set<string>())
    const emit = (warning: PasswordWarning | null) => {
      if (!warning) return
      // Keyed on the value as well as the code, matching every other package.
      // On the code alone, a component rendered with `minLength={-1}` and then
      // with `minLength={-5}` warned once and swallowed the second, distinct
      // misconfiguration — which is the case a developer most needs told.
      const key = `${warning.code}:${warning.received}`
      if (seen.has(key)) return
      seen.add(key)
      if (onWarn) onWarn(warning)
      // The library ships no console noise in production; this line is only
      // reached in development and is dropped from production builds.
      // eslint-disable-next-line no-console
      else console.warn(`[react-password-input] ${warning.message}`)
    }
    emit(inspectMinLength(minLengthProp, minLength))
    emit(inspectMaxLength(maxLengthProp, minLength))
    emit(inspectRuleIds(rules))
    emit(inspectAutoComplete(autoComplete))
    emit(inspectEstimate(estimateThrew))
  }, [minLengthProp, minLength, maxLengthProp, rules, autoComplete, estimateThrew, onWarn])

  const setValue = useCallback(
    (next: string) => {
      if (disabled || readOnly) return
      if (!isControlled) setUncontrolledValue(next)
      onChange?.(next)
    },
    [disabled, readOnly, isControlled, onChange],
  )

  const clear = useCallback(() => {
    setValue('')
  }, [setValue])

  const setRevealed = useCallback(
    (next: boolean) => {
      if (!isRevealControlled) setUncontrolledRevealed(next)
      onRevealChange?.(next)
    },
    [isRevealControlled, onRevealChange],
  )

  /**
   * Flip the mask, keeping focus and caret where they were.
   *
   * Swapping `type` re-creates the input's inner editor in every engine, and
   * WebKit in particular drops the selection when it does. Capturing the range
   * here and restoring it in a layout effect means the user's caret survives —
   * without which "reveal to check the last character" moves the caret to the
   * end and they type into the wrong place.
   */
  /**
   * Record the caret position, if the input currently owns focus.
   *
   * Wired to the toggle's `mousedown`, which is the last moment the value is
   * still true. A real pointer click collapses the input's selection as part of
   * the mousedown default action — and preventing that default keeps *focus* in
   * the input without preserving the selection, while listening on the input's
   * own `select` event is no help either, because the collapse fires one.
   * Reading during the mousedown *dispatch*, before any default action runs, is
   * the only point where the browser still reports where the user was.
   */
  const captureSelection = useCallback(() => {
    const input = inputRef.current
    if (!input || document.activeElement !== input) return
    lastSelection.current = readSelection(input)
  }, [])

  const toggleReveal = useCallback(() => {
    const input = inputRef.current
    if (input && document.activeElement === input) {
      // `captureSelection` has usually already run (pointer). For the keyboard
      // and programmatic paths there was no mousedown, and nothing has
      // disturbed the selection, so a live read is correct.
      pendingSelection.current = lastSelection.current ?? readSelection(input)
    }
    lastSelection.current = null
    setRevealed(!revealed)
  }, [revealed, setRevealed])

  useIsomorphicLayoutEffect(() => {
    const selection = pendingSelection.current
    if (!selection) return
    pendingSelection.current = null
    const input = inputRef.current
    // Unreachable in practice: `pendingSelection` is only ever set from a
    // handler that already dereferenced `inputRef`, and the ref cannot be
    // cleared between that handler and this effect without an unmount, which
    // would cancel the effect. Kept because the ref is nullable by type.
    /* v8 ignore next */
    if (!input) return

    const apply = () => {
      input.focus()
      // Guarded: setSelectionRange throws on input types that have no selection
      // model. `text` and `password` both do, but the type is consumer-visible
      // through the headless hook and this should not be a footgun there.
      try {
        input.setSelectionRange(selection[0], selection[1])
      } catch {
        /* the element does not support selection; focus alone is the best we can do */
      }
    }

    // Applied twice, deliberately.
    //
    // The layout-effect restore is what the user sees: it lands before paint,
    // so the caret never visibly jumps. But it does not survive on its own —
    // after a pointer-driven toggle React re-syncs the controlled input's value
    // once the click has finished dispatching, which happens after layout
    // effects and collapses the selection to 0,0. Tracing a real click shows
    // the range correct in a microtask and clobbered by the next frame.
    //
    // So the frame callback re-applies it, after React has finished. Dropping
    // the first call would leave a visible one-frame jump; dropping the second
    // would leave the caret at position 0, which is the bug this whole path
    // exists to prevent.
    apply()
    const frame = requestAnimationFrame(apply)
    return () => {
      cancelAnimationFrame(frame)
    }
  }, [revealed])

  /**
   * Caps Lock state, read from the event rather than tracked from keystrokes.
   *
   * `getModifierState` reports the real modifier at the time of the event, so
   * it is correct even when the key was pressed before the field had focus —
   * which is the common case, since the user turned it on while typing their
   * username.
   */
  const handleModifierEvent = useCallback(
    (event: KeyboardEvent<HTMLElement> | MouseEvent<HTMLElement>) => {
      if (!capsLockWarning) return
      const state = event.getModifierState('CapsLock')
      setCapsLock((previous) => (previous === state ? previous : state))
    },
    [capsLockWarning],
  )

  const handleFocus = useCallback(
    (event: FocusEvent<HTMLElement>) => {
      onFocus?.(event)
    },
    [onFocus],
  )

  const handleBlur = useCallback(
    (event: FocusEvent<HTMLElement>) => {
      // Focus moving to the reveal button is still "inside the field" — hiding
      // the password on the way to the button that shows it would make the
      // button impossible to use with a keyboard.
      const next = event.relatedTarget
      const insideField =
        next instanceof Node && event.currentTarget.parentElement?.contains(next) === true
      if (!insideField) {
        setCapsLock(false)
        // Guarded on `revealed`: an unguarded call reported `false` on every
        // blur whether or not anything changed, so a controlled parent saw a
        // stream of no-op updates — one per focus loss, for the whole session.
        if (hideOnBlur && revealed) setRevealed(false)
        onBlur?.(event)
      }
    },
    [hideOnBlur, revealed, setRevealed, onBlur],
  )

  return {
    value,
    revealed,
    type: revealed ? 'text' : 'password',
    capsLock: capsLockWarning && capsLock,
    strength,
    rules: ruleStates,
    compromised,
    checking,
    valid,
    minLength,
    maxLength,
    disabled,
    ids: {
      input: baseId,
      label: `${baseId}-label`,
      strength: `${baseId}-strength`,
      rules: `${baseId}-rules`,
      capsLock: `${baseId}-caps`,
      compromised: `${baseId}-compromised`,
      announcement: `${baseId}-announcement`,
    },
    inputRef,
    setValue,
    clear,
    setRevealed,
    toggleReveal,
    captureSelection,
    handleModifierEvent,
    handleBlur,
    handleFocus,
  }
}
