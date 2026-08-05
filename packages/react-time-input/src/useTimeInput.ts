import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { FocusEvent } from 'react'
import {
  AM,
  EMPTY_PARTS,
  PM,
  SEGMENT_WIDTH,
  fromDisplayHour,
  fromISO,
  isComplete,
  segmentRange,
  toDayPeriod,
  toDisplayHour,
  toISO,
  withinRange,
  wrap,
} from './time'
import type { TimeParts, TimeSegment } from './time'
import { dayPeriodNames, timePieces, usesHour12 } from './segments'
import type { TimePiece } from './segments'
import {
  inspectBound,
  inspectLocale,
  inspectOutOfRange,
  inspectRange,
  inspectStep,
  inspectValue,
} from './warn'
import type { TimeWarning } from './types'

export interface UseTimeInputOptions {
  value?: string | null
  defaultValue?: string | null
  onChange?: (value: string | null) => void
  onPartsChange?: (parts: TimeParts) => void
  min?: string
  max?: string
  emitOutOfRange?: boolean
  showSeconds?: boolean
  hour12?: boolean
  minuteStep?: number
  secondStep?: number
  locale?: string
  disabled?: boolean
  readOnly?: boolean
  onBlur?: (event: FocusEvent<HTMLElement>) => void
  onFocus?: (event: FocusEvent<HTMLElement>) => void
  onWarn?: (warning: TimeWarning) => void
  id?: string
}

export interface UseTimeInputResult {
  /** What is currently typed. `hour` is always 0–23, whatever the field shows. */
  parts: TimeParts
  /** `HH:mm[:ss]` when every needed segment is filled, else `null`. */
  value: string | null
  complete: boolean
  /** Complete, but outside `min`/`max`. */
  outOfRange: boolean
  /** The segments and separators for the locale, in display order. */
  pieces: TimePiece[]
  order: TimeSegment[]
  /** True when the field shows a 1–12 hour and a day period. */
  hour12: boolean
  /** The localised AM and PM words. */
  dayPeriods: [string, string]
  /** The segment that currently has focus. */
  focused: TimeSegment | null
  min: string | undefined
  max: string | undefined
  disabled: boolean
  readOnly: boolean
  ids: { group: string; hidden: string } & Record<TimeSegment, string>
  /**
   * Structural rather than `RefObject`: in @types/react 18 `RefObject.current`
   * is readonly, in 19 it is mutable. Declaring the shape keeps this assignable
   * under both, which matters because `react >= 18` is a peer.
   */
  segmentRefs: { current: Partial<Record<TimeSegment, HTMLElement | null>> }
  /** Inclusive bounds for one segment. */
  rangeFor: (segment: TimeSegment) => { min: number; max: number }
  /** What a segment currently displays as a number, or `null` when empty. */
  displayValue: (segment: TimeSegment) => number | null
  setSegment: (segment: TimeSegment, next: number | null) => void
  /** Arrow-key stepping, wrapping at the ends. */
  step: (segment: TimeSegment, delta: number) => void
  /** Feed one typed digit into a segment; auto-advances when it cannot take more. */
  typeDigit: (segment: TimeSegment, digit: string) => void
  /** `a` picks AM, `p` picks PM. Returns false when the key means nothing here. */
  typeLetter: (segment: TimeSegment, key: string) => boolean
  clearSegment: (segment: TimeSegment) => void
  clear: () => void
  moveFocus: (from: TimeSegment, delta: number) => void
  focusSegment: (segment: TimeSegment) => void
  handleSegmentFocus: (segment: TimeSegment, event: FocusEvent<HTMLElement>) => void
  handleBlur: (event: FocusEvent<HTMLElement>) => void
}

/** Coerce a step prop to something that divides an hour. */
function usableStep(step: number): number {
  return Number.isInteger(step) && step >= 1 && step <= 60 && 60 % step === 0 ? step : 1
}

/**
 * Headless state for a segmented time field: what is typed, where focus is, the
 * digit-entry buffer, and the locale-driven layout. Exported so a consumer can
 * build a completely custom renderer without reimplementing the fiddly parts —
 * the 12/24-hour translation and type-ahead with auto-advance especially.
 */
export function useTimeInput(options: UseTimeInputOptions): UseTimeInputResult {
  const {
    value: valueProp,
    defaultValue = null,
    onChange,
    onPartsChange,
    min: minProp,
    max: maxProp,
    emitOutOfRange = true,
    showSeconds = false,
    hour12: hour12Prop,
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
  const baseId = idProp ?? `rx-time-${reactId}`

  const hour12 = hour12Prop ?? usesHour12(locale)
  const minuteStep = usableStep(minuteStepProp)
  const secondStep = usableStep(secondStepProp)

  // A range no time can satisfy is dropped entirely rather than enforced — a
  // field nothing can be entered into is worse than a missing bound.
  const boundsUsable =
    minProp === undefined ||
    maxProp === undefined ||
    fromISO(minProp) === null ||
    fromISO(maxProp) === null ||
    minProp <= maxProp
  const min =
    boundsUsable && minProp !== undefined && fromISO(minProp) !== null ? minProp : undefined
  const max =
    boundsUsable && maxProp !== undefined && fromISO(maxProp) !== null ? maxProp : undefined

  const isControlled = valueProp !== undefined
  const [parts, setParts] = useState<TimeParts>(
    () => (isControlled ? fromISO(valueProp ?? '') : fromISO(defaultValue ?? '')) ?? EMPTY_PARTS,
  )

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
    setParts(fromISO(valueProp ?? '') ?? EMPTY_PARTS)
  }

  const [focused, setFocused] = useState<TimeSegment | null>(null)
  const segmentRefs = useRef<Partial<Record<TimeSegment, HTMLElement | null>>>({})
  /** Digits typed so far in the segment being typed into. Cleared on focus change. */
  const buffer = useRef<{ segment: TimeSegment; digits: string } | null>(null)

  const pieces = useMemo(
    () => timePieces(locale, showSeconds, hour12),
    [locale, showSeconds, hour12],
  )
  const order = useMemo(
    () => pieces.flatMap((piece) => (piece.kind === 'segment' ? [piece.type] : [])),
    [pieces],
  )
  const dayPeriods = useMemo(() => dayPeriodNames(locale), [locale])

  const value = toISO(parts, showSeconds)
  const complete = isComplete(parts, showSeconds)
  const outOfRange = value !== null && !withinRange(value, min, max)

  const ids = useMemo(
    () => ({
      group: baseId,
      hidden: `${baseId}-value`,
      hour: `${baseId}-hour`,
      minute: `${baseId}-minute`,
      second: `${baseId}-second`,
      dayPeriod: `${baseId}-daypart`,
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
    const emit = (warning: TimeWarning | null) => {
      if (!warning) return
      const key = `${warning.code}:${warning.received}`
      if (seen.has(key)) return
      seen.add(key)
      if (onWarn) onWarn(warning)
      // The library ships no console noise in production; this line is only
      // reached in development and is dropped from production builds.
      // eslint-disable-next-line no-console
      else console.warn(`[react-time-input] ${warning.message}`)
    }

    const raw = isControlled ? valueProp : defaultValue
    if (raw !== null && raw !== '') emit(inspectValue(raw, isControlled ? 'value' : 'defaultValue'))
    if (minProp !== undefined) emit(inspectBound(minProp, 'min'))
    if (maxProp !== undefined) emit(inspectBound(maxProp, 'max'))
    emit(inspectRange(minProp, maxProp))
    emit(inspectStep(minuteStepProp, 'minuteStep'))
    if (showSeconds) emit(inspectStep(secondStepProp, 'secondStep'))
    if (locale !== undefined) emit(inspectLocale(locale))
    if (value !== null) emit(inspectOutOfRange(value, min, max))
  }, [
    isControlled,
    valueProp,
    defaultValue,
    minProp,
    maxProp,
    minuteStepProp,
    secondStepProp,
    showSeconds,
    locale,
    value,
    min,
    max,
    onWarn,
  ])

  const rangeFor = useCallback((segment: TimeSegment) => segmentRange(segment, hour12), [hour12])

  /**
   * What a segment shows as a number.
   *
   * The hour is the interesting one: the field stores 0–23 and a 12-hour field
   * displays 1–12, so every read and write has to cross that boundary. Keeping
   * the translation in one place is what stops "12 AM" becoming hour 12.
   */
  const displayValue = useCallback(
    (segment: TimeSegment): number | null => {
      if (segment === 'hour') {
        return parts.hour === null ? null : toDisplayHour(parts.hour, hour12)
      }
      if (segment === 'dayPeriod') {
        return parts.hour === null ? null : toDayPeriod(parts.hour)
      }
      return segment === 'minute' ? parts.minute : parts.second
    },
    [parts, hour12],
  )

  const lastEmitted = useRef<string | null>(toISO(parts, showSeconds))

  const emitChange = useCallback(
    (next: TimeParts) => {
      const iso = toISO(next, showSeconds)
      if (iso === lastEmitted.current) return
      lastEmitted.current = iso
      // An out-of-range time is still reported by default: silently swallowing
      // what the user typed leaves them staring at a field that looks accepted
      // and a form that will not submit, with nothing connecting the two.
      onChange?.(iso !== null && !emitOutOfRange && !withinRange(iso, min, max) ? null : iso)
    },
    [onChange, showSeconds, emitOutOfRange, min, max],
  )

  /**
   * Apply a segment edit and report it.
   *
   * `provisional` means "a digit landed but the number is not finished". Typing
   * `15` into a minute passes through `1`, and with the other segments filled
   * that is already a complete time — so an unconditional emit reports 1 past
   * the hour on the way to 15 past, and a form that saves on change persists it.
   */
  const commit = useCallback(
    (next: TimeParts, provisional = false) => {
      if (disabled || readOnly) return
      setParts(next)
      onPartsChange?.(next)
      if (!provisional) emitChange(next)
    },
    [disabled, readOnly, onPartsChange, emitChange],
  )

  const flush = useCallback(() => {
    if (disabled || readOnly) return
    emitChange(parts)
  }, [disabled, readOnly, emitChange, parts])

  /** Write a segment's *display* value back into the 0–23 storage. */
  const withSegment = useCallback(
    (segment: TimeSegment, next: number | null): TimeParts => {
      if (segment === 'minute') return { ...parts, minute: next }
      if (segment === 'second') return { ...parts, second: next }
      if (segment === 'hour') {
        if (next === null) return { ...parts, hour: null }
        if (!hour12) return { ...parts, hour: next }
        // Keep whichever half the user already chose; default to AM when the
        // hour is being set for the first time.
        const period = parts.hour === null ? AM : toDayPeriod(parts.hour)
        return { ...parts, hour: fromDisplayHour(next, period) }
      }
      // dayPeriod: moving the existing hour across the AM/PM boundary. With no
      // hour yet there is nothing to move, so the choice is remembered as the
      // corresponding midnight/noon hour.
      if (next === null) return parts
      const display = parts.hour === null ? 12 : toDisplayHour(parts.hour, true)
      return { ...parts, hour: fromDisplayHour(display, next) }
    },
    [parts, hour12],
  )

  const setSegment = useCallback(
    (segment: TimeSegment, next: number | null) => {
      buffer.current = null
      commit(withSegment(segment, next))
    },
    [commit, withSegment],
  )

  const stepFor = useCallback(
    (segment: TimeSegment) =>
      segment === 'minute' ? minuteStep : segment === 'second' ? secondStep : 1,
    [minuteStep, secondStep],
  )

  const step = useCallback(
    (segment: TimeSegment, delta: number) => {
      buffer.current = null
      const { min: low, max: high } = segmentRange(segment, hour12)
      const current = displayValue(segment)
      const size = stepFor(segment)
      const next =
        current === null
          ? // First press lands on the start value rather than one step past it.
            low
          : wrap(current + delta * size, low, high)
      commit(withSegment(segment, next))
    },
    [hour12, displayValue, stepFor, commit, withSegment],
  )

  const focusSegment = useCallback((segment: TimeSegment) => {
    segmentRefs.current[segment]?.focus()
  }, [])

  const moveFocus = useCallback(
    (from: TimeSegment, delta: number) => {
      const index = order.indexOf(from)
      // Clamped, not wrapped. Tab is the control for leaving the field; an
      // arrow key that jumped from the last segment back to the first would
      // make the field a trap you cannot arrow out of.
      const next = order[Math.min(order.length - 1, Math.max(0, index + delta))]
      if (next !== undefined && next !== from) focusSegment(next)
    },
    [order, focusSegment],
  )

  const typeDigit = useCallback(
    (segment: TimeSegment, digit: string) => {
      if (disabled || readOnly) return
      // A day period is not a number; digits mean nothing there.
      if (segment === 'dayPeriod') return

      const { min: low, max: high } = segmentRange(segment, hour12)
      const previous = buffer.current?.segment === segment ? buffer.current.digits : ''

      let digits = previous + digit
      let next = Number(digits)
      // Overflowing restarts from the new digit rather than rejecting it:
      // typing 1 then 9 into a 12-hour hour means the user wants 9 o'clock.
      if (next > high) {
        digits = digit
        next = Number(digit)
      }

      // A lone leading zero is a legitimate intermediate state in a 12-hour
      // field, where 0 is not an hour, but it is not a value.
      if (next < low) {
        buffer.current = { segment, digits }
        return
      }

      buffer.current = { segment, digits }
      const finished = digits.length >= SEGMENT_WIDTH || next * 10 > high
      commit(withSegment(segment, next), !finished)

      if (finished) {
        buffer.current = null
        moveFocus(segment, 1)
      }
    },
    [disabled, readOnly, hour12, commit, withSegment, moveFocus],
  )

  const typeLetter = useCallback(
    (segment: TimeSegment, key: string): boolean => {
      if (segment !== 'dayPeriod' || disabled || readOnly) return false
      const lower = key.toLowerCase()
      // Matched against the localised words as well as `a`/`p`, so a German
      // user typing `v` for "vorm." is understood too.
      const [am, pm] = dayPeriods
      if (lower === 'a' || lower === am.toLowerCase().charAt(0)) {
        commit(withSegment('dayPeriod', AM))
        return true
      }
      if (lower === 'p' || lower === pm.toLowerCase().charAt(0)) {
        commit(withSegment('dayPeriod', PM))
        return true
      }
      return false
    },
    [disabled, readOnly, dayPeriods, commit, withSegment],
  )

  const clearSegment = useCallback(
    (segment: TimeSegment) => {
      buffer.current = null
      commit(withSegment(segment, null))
    },
    [commit, withSegment],
  )

  const clear = useCallback(() => {
    buffer.current = null
    commit(EMPTY_PARTS)
  }, [commit])

  const handleSegmentFocus = useCallback(
    (segment: TimeSegment, event: FocusEvent<HTMLElement>) => {
      // A fresh segment starts a fresh number, and leaving a half-typed one
      // settles it so a minute abandoned at `1` is reported rather than withheld.
      if (buffer.current !== null && buffer.current.segment !== segment) flush()
      buffer.current = null
      setFocused(segment)
      onFocus?.(event)
    },
    [onFocus, flush],
  )

  /**
   * Only emit blur when focus genuinely leaves the field. Arrowing between
   * segments moves focus between siblings, and a naive per-segment onBlur marks
   * the field touched mid-entry — firing validation while the user is still
   * halfway through the time.
   */
  const handleBlur = useCallback(
    (event: FocusEvent<HTMLElement>) => {
      const next = event.relatedTarget
      if (next instanceof Node && event.currentTarget.contains(next)) return
      if (buffer.current !== null) flush()
      buffer.current = null
      setFocused(null)
      onBlur?.(event)
    },
    [onBlur, flush],
  )

  return {
    parts,
    value,
    complete,
    outOfRange,
    pieces,
    order,
    hour12,
    dayPeriods,
    focused,
    min,
    max,
    disabled,
    readOnly,
    ids,
    segmentRefs,
    rangeFor,
    displayValue,
    setSegment,
    step,
    typeDigit,
    typeLetter,
    clearSegment,
    clear,
    moveFocus,
    focusSegment,
    handleSegmentFocus,
    handleBlur,
  }
}
