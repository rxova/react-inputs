import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { FocusEvent } from 'react'
import { clampValue, getFills, getSteps, normalizeMax, snap } from './math'
import { inspectMax, inspectValue } from './warn'
import type { RatingRounding, RatingWarning } from './types'

const DEFAULT_MAX = 5

export interface UseRatingOptions {
  /** Controlled score. Clamped to [0, max]; NaN/Infinity become 0. */
  value?: number
  /** Uncontrolled initial score. Ignored when `value` is provided. */
  defaultValue?: number
  /** Number of icons rendered. Positive integer. @default 5 */
  max?: number
  /** Quantization grid: 1 = whole icons, 0.5 = halves, 0 = continuous. @default 0 */
  precision?: number
  /** Direction of the snap onto the grid. @default 'nearest' */
  rounding?: RatingRounding
  /** Providing this makes the component interactive. */
  onChange?: (value: number) => void
  /** Hover/keyboard preview; `null` when the preview ends. */
  onHoverChange?: (value: number | null) => void
  /** Fires when focus leaves the whole group, not when moving between icons. */
  onBlur?: (event: FocusEvent<HTMLElement>) => void
  /** Callback invoked when a warning is emitted. */
  onWarn?: (warning: RatingWarning) => void
  /** Force read-only even when `onChange` is present. @default `!onChange` */
  readOnly?: boolean
  disabled?: boolean
  /** Re-selecting the current value clears to 0. @default true when interactive */
  allowClear?: boolean
  /** Radio group name; also emits a value readable by a native `<form>`. */
  name?: string
  /** Base id; option inputs derive `${id}-1`, `${id}-2`, ... */
  id?: string
}

export interface UseRatingResult {
  /** Icon count after normalization. */
  max: number
  /** The committed score, clamped and snapped. */
  value: number
  /** What should be painted right now — the hover preview if any, else `value`. */
  displayValue: number
  /** Per-icon fill ratios for `displayValue`. */
  fills: number[]
  /** Selectable grid values. */
  steps: number[]
  /** True when the component renders as a control rather than an image. */
  interactive: boolean
  /** True when the control will actually accept input (interactive and not disabled). */
  canChange: boolean
  disabled: boolean
  hoverValue: number | null
  focusedValue: number | null
  name: string
  baseId: string
  /**
   * Structural rather than `RefObject`: in @types/react 18 `RefObject.current`
   * is readonly, in 19 it is mutable. Declaring the shape keeps this assignable
   * under both, which matters because `react >= 18` is a peer.
   */
  rootRef: { current: HTMLSpanElement | null }
  /** Commit a value verbatim (keyboard entry). */
  commit: (next: number) => void
  /** Pointer semantics: re-selecting the current value clears it. */
  select: (next: number) => void
  setHover: (next: number | null) => void
  setFocused: (next: number | null) => void
  handleBlur: (event: FocusEvent<HTMLElement>) => void
}

/**
 * Headless state for a rating: controlled/uncontrolled value, hover preview,
 * focus tracking, and group-level blur. Exported so consumers can build a
 * completely custom renderer without reimplementing the fiddly parts.
 */
export function useRating(options: UseRatingOptions): UseRatingResult {
  const {
    value: valueProp,
    defaultValue = 0,
    max: maxProp = DEFAULT_MAX,
    precision = 0,
    rounding = 'nearest',
    onChange,
    onHoverChange,
    onBlur,
    onWarn,
    readOnly,
    disabled = false,
    allowClear = true,
    name: nameProp,
    id: idProp,
  } = options

  const max = normalizeMax(maxProp, DEFAULT_MAX)
  const reactId = useId()
  const baseId = idProp ?? `rx-rating-${reactId}`
  const name = nameProp ?? `rfs-name-${reactId}`

  const isControlled = valueProp !== undefined
  const [uncontrolled, setUncontrolled] = useState(defaultValue)
  const rawValue = isControlled ? valueProp : uncontrolled

  const [hoverValue, setHoverValue] = useState<number | null>(null)
  const [focusedValue, setFocusedValue] = useState<number | null>(null)
  const rootRef = useRef<HTMLSpanElement | null>(null)

  // `disabled` deliberately does NOT clear `interactive`. A disabled control
  // must still be exposed as a disabled control — degrading it to a plain
  // image would hide the field from screen-reader users filling the form.
  // `canChange` is what actually gates mutation.
  const interactive = readOnly === undefined ? onChange !== undefined : !readOnly
  const canChange = interactive && !disabled

  const value = useMemo(
    () => snap(clampValue(rawValue, max), precision, rounding),
    [rawValue, max, precision, rounding],
  )

  const displayValue = hoverValue ?? value
  const fills = useMemo(() => getFills(displayValue, max), [displayValue, max])
  const steps = useMemo(() => getSteps(max, precision), [max, precision])

  // Development-only input diagnostics. The value above is already clamped and
  // painted; this only tells the developer *why* it differs from what they
  // passed. Guarded so a production bundler drops the branch — and with it
  // `inspect*` and `warn.ts` entirely — leaving no runtime cost. Deduped per
  // instance so a controlled `value` re-rendering many times warns only once.
  const warnedRef = useRef<Set<string> | null>(null)
  useEffect(() => {
    // A bundler folds this to a constant and drops the whole effect body in a
    // production build, so the branch is unreachable once compiled and cannot
    // be exercised by the (always-development) test build.
    /* v8 ignore next */
    if (process.env.NODE_ENV === 'production') return
    const seen = (warnedRef.current ??= new Set<string>())
    const emit = (warning: RatingWarning | null) => {
      if (!warning) return
      const key = `${warning.code}:${String(warning.received)}`
      if (seen.has(key)) return
      seen.add(key)
      if (onWarn) onWarn(warning)
      // The library ships no console noise in production; this line is only
      // reached in development and is dropped from production builds.
      // eslint-disable-next-line no-console
      else console.warn(`[react-feedback-stars] ${warning.message}`)
    }
    emit(inspectValue(rawValue, max, isControlled ? 'value' : 'defaultValue'))
    emit(inspectMax(maxProp, max))
  }, [rawValue, max, maxProp, isControlled, onWarn])

  /** Commit a value as-is. No toggle, no clear-on-reselect. */
  const commit = useCallback(
    (next: number) => {
      if (!canChange) return
      const committed = clampValue(next, max)
      if (!isControlled) setUncontrolled(committed)
      onChange?.(committed)
    },
    [canChange, isControlled, max, onChange],
  )

  /**
   * Pointer-selection semantics: re-selecting the current value clears it.
   * Lives here rather than in the component so a custom renderer gets the
   * affordance for free. Keyboard entry uses `commit` instead — typing "3"
   * when the value is already 3 should mean 3, not zero.
   */
  const select = useCallback(
    (next: number) => {
      if (!canChange) return
      const requested = clampValue(next, max)
      commit(allowClear && requested === value ? 0 : requested)
    },
    [allowClear, canChange, commit, max, value],
  )

  const setHover = useCallback(
    (next: number | null) => {
      if (!canChange) return
      setHoverValue((prev) => {
        if (prev === next) return prev
        onHoverChange?.(next)
        return next
      })
    },
    [canChange, onHoverChange],
  )

  const setFocused = useCallback((next: number | null) => {
    setFocusedValue(next)
  }, [])

  /**
   * Only emit blur when focus genuinely leaves the group. Arrowing between
   * icons moves focus between sibling radios, and a naive per-input onBlur
   * marks the field touched mid-interaction — firing validation errors while
   * the user is still choosing.
   */
  const handleBlur = useCallback(
    (event: FocusEvent<HTMLElement>) => {
      const next = event.relatedTarget
      if (next instanceof Node && rootRef.current?.contains(next)) return
      setFocusedValue(null)
      setHoverValue((prev) => {
        if (prev !== null) onHoverChange?.(null)
        return null
      })
      onBlur?.(event)
    },
    [onBlur, onHoverChange],
  )

  return {
    max,
    value,
    displayValue,
    fills,
    steps,
    interactive,
    canChange,
    disabled,
    hoverValue,
    focusedValue,
    name,
    baseId,
    rootRef,
    commit,
    select,
    setHover,
    setFocused,
    handleBlur,
  }
}
