import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { FocusEvent } from 'react'
import {
  EMPTY_PARTS,
  clamp,
  durationToSeconds,
  fromISODuration,
  isComplete,
  normalise,
  toISODuration,
  toSeconds,
  unitRange,
  unitWidth,
  withinDurationRange,
} from './duration'
import type { DurationParts, DurationUnit } from './duration'
import { durationPieces, unitName, usableUnits } from './segments'
import type { DurationPiece } from './segments'
import {
  inspectBound,
  inspectLocale,
  inspectOutOfRange,
  inspectRange,
  inspectStep,
  inspectTruncation,
  inspectUnits,
  inspectValue,
} from './warn'
import type { DurationWarning } from './types'

/** What a field shows when `units` is not given: the timesheet default. */
export const DEFAULT_UNITS: readonly DurationUnit[] = ['hour', 'minute']

/** Used when `Intl` cannot name a unit — see `unitName` in `segments.ts`. */
const DEFAULT_NAMES: Record<DurationUnit, string> = {
  day: 'Days',
  hour: 'Hours',
  minute: 'Minutes',
  second: 'Seconds',
}

export interface UseDurationInputOptions {
  value?: string | null
  defaultValue?: string | null
  onChange?: (value: string | null) => void
  onPartsChange?: (parts: DurationParts) => void
  min?: string
  max?: string
  emitOutOfRange?: boolean
  units?: DurationUnit[]
  minuteStep?: number
  secondStep?: number
  locale?: string
  disabled?: boolean
  readOnly?: boolean
  onBlur?: (event: FocusEvent<HTMLElement>) => void
  onFocus?: (event: FocusEvent<HTMLElement>) => void
  onWarn?: (warning: DurationWarning) => void
  id?: string
}

export interface UseDurationInputResult {
  /** What is currently typed, per unit. Units the field does not show stay `null`. */
  parts: DurationParts
  /** An ISO 8601 duration when every shown unit is filled, else `null`. */
  value: string | null
  /** The same duration in whole seconds, or `null`. */
  seconds: number | null
  complete: boolean
  /** Complete, but outside `min`/`max`. */
  outOfRange: boolean
  /** The units and suffixes, in display order. */
  pieces: DurationPiece[]
  /** The units this field edits, largest first. Coerced from the `units` prop. */
  units: DurationUnit[]
  /** The unit that currently has focus. */
  focused: DurationUnit | null
  min: string | undefined
  max: string | undefined
  disabled: boolean
  readOnly: boolean
  ids: { group: string; hidden: string } & Record<DurationUnit, string>
  /**
   * Structural rather than `RefObject`: in @types/react 18 `RefObject.current`
   * is readonly, in 19 it is mutable. Declaring the shape keeps this assignable
   * under both, which matters because `react >= 18` is a peer.
   */
  segmentRefs: { current: Partial<Record<DurationUnit, HTMLElement | null>> }
  /** Inclusive bounds for one unit. `max` is `Infinity` on the leading unit. */
  rangeFor: (unit: DurationUnit) => { min: number; max: number }
  /** The locale's accessible name for a unit. */
  nameFor: (unit: DurationUnit) => string
  setSegment: (unit: DurationUnit, next: number | null) => void
  /** Arrow-key stepping. Clamps rather than wraps — see the note on `step`. */
  step: (unit: DurationUnit, delta: number) => void
  /** Feed one typed digit into a unit; auto-advances when it cannot take more. */
  typeDigit: (unit: DurationUnit, digit: string) => void
  clearSegment: (unit: DurationUnit) => void
  clear: () => void
  moveFocus: (from: DurationUnit, delta: number) => void
  focusSegment: (unit: DurationUnit) => void
  handleSegmentFocus: (unit: DurationUnit, event: FocusEvent<HTMLElement>) => void
  handleBlur: (event: FocusEvent<HTMLElement>) => void
}

/** Coerce a step prop to something that divides 60. */
function usableStep(step: number): number {
  return Number.isInteger(step) && step >= 1 && step <= 60 && 60 % step === 0 ? step : 1
}

/**
 * Call a purely informational consumer callback without letting it break the
 * field.
 *
 * `onPartsChange` and `onWarn` report what already happened — the state is set
 * before either runs — so an exception from one of them can only destroy work
 * the user has already done. `onChange` is deliberately *not* routed through
 * here: it is the consumer's state setter, and swallowing its exception would
 * leave the parent holding a stale value with the error that explains it gone.
 */
function notify(run: () => void): void {
  try {
    run()
  } catch {
    // Intentionally swallowed; see above.
  }
}

/**
 * Headless state for a segmented duration field: what is typed, where focus is,
 * the digit-entry buffer, and the unit layout. Exported so a consumer can build
 * a completely custom renderer without reimplementing the fiddly parts — the
 * unbounded leading unit, the carry on blur, and type-ahead with auto-advance
 * especially.
 */
export function useDurationInput(options: UseDurationInputOptions): UseDurationInputResult {
  const {
    value: valueProp,
    defaultValue = null,
    onChange,
    onPartsChange,
    min: minProp,
    max: maxProp,
    emitOutOfRange = true,
    units: unitsProp,
    minuteStep: minuteStepProp = 1,
    secondStep: secondStepProp = 1,
    locale,
    disabled = false,
    readOnly = false,
    onBlur,
    onFocus,
    onWarn,
    id: idProp,
  } = options

  const reactId = useId()
  const baseId = idProp ?? `rx-duration-${reactId}`

  const units = useMemo(() => usableUnits(unitsProp, DEFAULT_UNITS), [unitsProp])
  const minuteStep = usableStep(minuteStepProp)
  const secondStep = usableStep(secondStepProp)

  // A range no duration can satisfy is dropped entirely rather than enforced — a
  // field nothing can be entered into is worse than a missing bound. Compared
  // through seconds, because these strings do not sort.
  const minSeconds = minProp === undefined ? null : toSeconds(minProp)
  const maxSeconds = maxProp === undefined ? null : toSeconds(maxProp)
  const boundsUsable = minSeconds === null || maxSeconds === null || minSeconds <= maxSeconds
  const min = boundsUsable && minSeconds !== null ? minProp : undefined
  const max = boundsUsable && maxSeconds !== null ? maxProp : undefined

  const isControlled = valueProp !== undefined
  const [parts, setParts] = useState<DurationParts>(
    () =>
      (isControlled
        ? fromISODuration(valueProp ?? '', units)
        : fromISODuration(defaultValue ?? '', units)) ?? EMPTY_PARTS,
  )

  /**
   * Digits typed so far in the unit being typed into. Cleared on focus change,
   * and stamped with the controlled `value` they were typed against — see
   * `liveBuffer`.
   */
  const buffer = useRef<{
    unit: DurationUnit
    digits: string
    basis: string | null | undefined
  } | null>(null)

  /**
   * Re-sync from a controlled `value` when the *prop* changes.
   *
   * Adjusting state during render rather than in an effect, which is React's
   * documented pattern for this: an effect would paint the stale segments for
   * one frame first. Compared against the previous prop rather than against the
   * current segments, because mid-entry the segments have no canonical form at
   * all and a comparison against `null` would wipe them on every keystroke.
   */
  const [previousValueProp, setPreviousValueProp] = useState(valueProp)
  if (isControlled && valueProp !== previousValueProp) {
    setPreviousValueProp(valueProp)
    setParts(fromISODuration(valueProp ?? '', units) ?? EMPTY_PARTS)
  }

  /**
   * The buffer, unless a controlled `value` has landed since it was filled.
   *
   * A half-typed number belongs to the segment it was typed into, and a value
   * arriving from outside replaces that segment. Keeping the digits lets the
   * next keystroke extend a number that is no longer on screen: type `1` into
   * the minutes, let the parent write a new duration, type `5`, and the minutes
   * become 15 — a number the user never typed.
   *
   * Clearing the ref inside the re-sync above would be a ref write during
   * render, which React forbids. Stamping the buffer with the prop it was typed
   * against and checking that stamp here is the same guarantee, synchronously,
   * from the handlers that actually read it.
   */
  const liveBuffer = useCallback(
    () => (buffer.current?.basis === previousValueProp ? buffer.current : null),
    [previousValueProp],
  )

  const [focused, setFocused] = useState<DurationUnit | null>(null)
  const segmentRefs = useRef<Partial<Record<DurationUnit, HTMLElement | null>>>({})

  const pieces = useMemo(() => durationPieces(units, locale), [units, locale])

  // Normalised, so the value and the hidden form field always carry the
  // canonical spelling even while the segments still show what was typed. The
  // segments are what the user is editing; this is what the application gets.
  const value = toISODuration(normalise(parts, units), units)
  const complete = isComplete(parts, units)
  const seconds = complete ? durationToSeconds(parts) : null
  const outOfRange = value !== null && !withinDurationRange(value, min, max)

  const ids = useMemo(
    () => ({
      group: baseId,
      hidden: `${baseId}-value`,
      day: `${baseId}-day`,
      hour: `${baseId}-hour`,
      minute: `${baseId}-minute`,
      second: `${baseId}-second`,
    }),
    [baseId],
  )

  // Development-only configuration diagnostics. Guarded so a production bundler
  // drops the branch — and with it `warn.ts` entirely. Deduped per instance so
  // a re-rendering parent warns once, not once per keystroke.
  const warned = useRef<Set<string> | null>(null)
  useEffect(() => {
    // A bundler folds this to a constant and drops the whole effect body in a
    // production build, so the branch is unreachable once compiled and cannot
    // be exercised by the (always-development) test build.
    /* v8 ignore next */
    if (process.env.NODE_ENV === 'production') return
    const seen = (warned.current ??= new Set<string>())
    const emit = (warning: DurationWarning | null) => {
      if (!warning) return
      const key = `${warning.code}:${warning.received}`
      if (seen.has(key)) return
      seen.add(key)
      if (onWarn)
        notify(() => {
          onWarn(warning)
        })
      // The library ships no console noise in production; this line is only
      // reached in development and is dropped from production builds.
      // eslint-disable-next-line no-console
      else console.warn(`[react-duration-input] ${warning.message}`)
    }

    const raw = isControlled ? valueProp : defaultValue
    const prop = isControlled ? 'value' : 'defaultValue'
    if (raw !== null && raw !== '') {
      emit(inspectValue(raw, prop))
      emit(inspectTruncation(raw, units, prop))
    }
    if (minProp !== undefined) emit(inspectBound(minProp, 'min'))
    if (maxProp !== undefined) emit(inspectBound(maxProp, 'max'))
    emit(inspectRange(minProp, maxProp))
    if (unitsProp !== undefined) emit(inspectUnits(unitsProp))
    if (units.includes('minute')) emit(inspectStep(minuteStepProp, 'minuteStep'))
    if (units.includes('second')) emit(inspectStep(secondStepProp, 'secondStep'))
    if (locale !== undefined) emit(inspectLocale(locale))
    if (value !== null) emit(inspectOutOfRange(value, min, max))
  }, [
    isControlled,
    valueProp,
    defaultValue,
    minProp,
    maxProp,
    unitsProp,
    units,
    minuteStepProp,
    secondStepProp,
    locale,
    value,
    min,
    max,
    onWarn,
  ])

  const rangeFor = useCallback((unit: DurationUnit) => unitRange(unit, units), [units])

  const nameFor = useCallback(
    (unit: DurationUnit) => unitName(unit, locale) ?? DEFAULT_NAMES[unit],
    [locale],
  )

  const lastEmitted = useRef<string | null>(value)

  const emitChange = useCallback(
    (next: DurationParts) => {
      // Normalised before it leaves. The segments may legitimately hold `90`
      // minutes mid-entry, but a consumer should never receive two spellings of
      // the same duration — `PT90M` on the keystroke and `PT1H30M` on blur — and
      // have to know they are equal.
      const iso = toISODuration(normalise(next, units), units)
      if (iso === lastEmitted.current) return
      lastEmitted.current = iso
      // An out-of-range duration is still reported by default: silently
      // swallowing what the user typed leaves them staring at a field that
      // looks accepted and a form that will not submit, with nothing
      // connecting the two.
      onChange?.(
        iso !== null && !emitOutOfRange && !withinDurationRange(iso, min, max) ? null : iso,
      )
    },
    [onChange, units, emitOutOfRange, min, max],
  )

  /**
   * Apply an edit and report it.
   *
   * `provisional` means "a digit landed but the number is not finished". Typing
   * `15` into minutes passes through `1`, and with the other units filled that
   * is already a complete duration — so an unconditional emit reports one
   * minute on the way to fifteen, and a form that saves on change persists it.
   */
  const commit = useCallback(
    (next: DurationParts, provisional = false) => {
      if (disabled || readOnly) return
      setParts(next)
      if (onPartsChange)
        notify(() => {
          onPartsChange(next)
        })
      if (!provisional) emitChange(next)
    },
    [disabled, readOnly, onPartsChange, emitChange],
  )

  const withSegment = useCallback(
    (unit: DurationUnit, next: number | null): DurationParts => ({ ...parts, [unit]: next }),
    [parts],
  )

  const setSegment = useCallback(
    (unit: DurationUnit, next: number | null) => {
      buffer.current = null
      commit(withSegment(unit, next))
    },
    [commit, withSegment],
  )

  const stepFor = useCallback(
    (unit: DurationUnit) => (unit === 'minute' ? minuteStep : unit === 'second' ? secondStep : 1),
    [minuteStep, secondStep],
  )

  /**
   * Arrow-key stepping. Clamped, not wrapped.
   *
   * The time field wraps because a clock does: 23:59 plus a minute is 00:00,
   * and stepping past the end of an hour is a real operation. A duration has no
   * such cycle. Arrowing down from `0m` to `59m` would silently lengthen the
   * duration by an hour, and arrowing up past the leading unit's ceiling is
   * meaningless because there is no ceiling. So each unit stops at its own ends.
   */
  const step = useCallback(
    (unit: DurationUnit, delta: number) => {
      buffer.current = null
      const { min: low, max: high } = unitRange(unit, units)
      const current = parts[unit]
      const size = stepFor(unit)
      // First press lands on the start value rather than one step past it.
      const next = current === null ? low : clamp(current + delta * size, low, high)
      commit(withSegment(unit, next))
    },
    [units, parts, stepFor, commit, withSegment],
  )

  const focusSegment = useCallback((unit: DurationUnit) => {
    segmentRefs.current[unit]?.focus()
  }, [])

  const moveFocus = useCallback(
    (from: DurationUnit, delta: number) => {
      const index = units.indexOf(from)
      // Clamped, not wrapped. Tab is the control for leaving the field; an
      // arrow key that jumped from the last segment back to the first would
      // make the field a trap you cannot arrow out of.
      const next = units[Math.min(units.length - 1, Math.max(0, index + delta))]
      if (next !== undefined && next !== from) focusSegment(next)
    },
    [units, focusSegment],
  )

  /**
   * Settle whatever is typed: carry overflow upward, then report.
   *
   * This is where `90` in the minutes of an `h:m` field becomes `1h 30m`. It
   * runs on blur and when focus leaves a segment, never mid-keystroke — carrying
   * while the user is still typing would move the digits out from under them.
   */
  const flush = useCallback(() => {
    if (disabled || readOnly) return
    const settled = normalise(parts, units)
    if (settled !== parts) setParts(settled)
    emitChange(settled)
  }, [disabled, readOnly, parts, units, emitChange])

  const typeDigit = useCallback(
    (unit: DurationUnit, digit: string) => {
      if (disabled || readOnly) return

      const width = unitWidth(unit, units)
      const live = liveBuffer()
      const previous = live?.unit === unit ? live.digits : ''

      /*
       * Bounded by the digit width, *not* by the unit's range. Typing `90` into
       * the minutes of an `h:m` field has to be possible — it is how someone
       * enters an hour and a half — so the 0–59 rule is applied by the carry on
       * blur rather than by refusing the keystroke.
       *
       * There is deliberately no overflow-restart here, the way the time field
       * has one. Width is the only ceiling, and the buffer is cleared the moment
       * the width is reached, so a number can never grow past it in the first
       * place: the restart branch would be unreachable code that reads like a
       * rule.
       */
      const digits = previous + digit
      const next = Number(digits)

      buffer.current = { unit, digits, basis: previousValueProp }
      const finished = digits.length >= width
      commit(withSegment(unit, next), !finished)

      if (finished) {
        buffer.current = null
        moveFocus(unit, 1)
      }
    },
    [disabled, readOnly, units, commit, withSegment, moveFocus, liveBuffer, previousValueProp],
  )

  const clearSegment = useCallback(
    (unit: DurationUnit) => {
      buffer.current = null
      commit(withSegment(unit, null))
    },
    [commit, withSegment],
  )

  const clear = useCallback(() => {
    buffer.current = null
    commit(EMPTY_PARTS)
  }, [commit])

  const handleSegmentFocus = useCallback(
    (unit: DurationUnit, event: FocusEvent<HTMLElement>) => {
      // A fresh segment starts a fresh number, and leaving a half-typed one
      // settles it so a minute abandoned at `1` is reported rather than withheld.
      const live = liveBuffer()
      if (live !== null && live.unit !== unit) flush()
      buffer.current = null
      setFocused(unit)
      onFocus?.(event)
    },
    [onFocus, flush, liveBuffer],
  )

  /**
   * Only emit blur when focus genuinely leaves the field. Arrowing between
   * segments moves focus between siblings, and a naive per-segment onBlur marks
   * the field touched mid-entry — firing validation while the user is still
   * halfway through the duration.
   */
  const handleBlur = useCallback(
    (event: FocusEvent<HTMLElement>) => {
      const next = event.relatedTarget
      if (next instanceof Node && event.currentTarget.contains(next)) return
      buffer.current = null
      setFocused(null)
      flush()
      onBlur?.(event)
    },
    [onBlur, flush],
  )

  return {
    parts,
    value,
    seconds,
    complete,
    outOfRange,
    pieces,
    units,
    focused,
    min,
    max,
    disabled,
    readOnly,
    ids,
    segmentRefs,
    rangeFor,
    nameFor,
    setSegment,
    step,
    typeDigit,
    clearSegment,
    clear,
    moveFocus,
    focusSegment,
    handleSegmentFocus,
    handleBlur,
  }
}
