import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { FocusEvent } from 'react'
import {
  EMPTY_PARTS,
  clampDay,
  fromISO,
  isComplete,
  segmentRange,
  segmentWidth,
  toISO,
  withinRange,
  wrap,
} from './date'
import type { DateParts, DateSegment } from './date'
import { datePieces, monthNames } from './segments'
import type { DatePiece } from './segments'
import { inspectBound, inspectLocale, inspectOutOfRange, inspectRange, inspectValue } from './warn'
import type { DateWarning } from './types'

export interface UseDateInputOptions {
  value?: string | null
  defaultValue?: string | null
  onChange?: (value: string | null) => void
  onPartsChange?: (parts: DateParts) => void
  min?: string
  max?: string
  emitOutOfRange?: boolean
  locale?: string
  disabled?: boolean
  readOnly?: boolean
  onBlur?: (event: FocusEvent<HTMLElement>) => void
  onFocus?: (event: FocusEvent<HTMLElement>) => void
  onWarn?: (warning: DateWarning) => void
  id?: string
}

export interface UseDateInputResult {
  /** What is currently typed, segment by segment. */
  parts: DateParts
  /** `YYYY-MM-DD` when every segment is filled and the date is real, else `null`. */
  value: string | null
  /** Every segment filled in. */
  complete: boolean
  /** Complete, but outside `min`/`max`. */
  outOfRange: boolean
  /** The segments and separators for the locale, in display order. */
  pieces: DatePiece[]
  /** Just the segment types, in display order. */
  order: DateSegment[]
  /** Localised month names, for the month segment's `aria-valuetext`. */
  months: string[]
  /** The segment that currently has focus. */
  focused: DateSegment | null
  /** Usable bounds after coercion — a `min` after `max` leaves both undefined. */
  min: string | undefined
  max: string | undefined
  disabled: boolean
  readOnly: boolean
  ids: { group: string; hidden: string } & Record<DateSegment, string>
  /**
   * Structural rather than `RefObject`: in @types/react 18 `RefObject.current`
   * is readonly, in 19 it is mutable. Declaring the shape keeps this assignable
   * under both, which matters because `react >= 18` is a peer.
   */
  segmentRefs: { current: Partial<Record<DateSegment, HTMLElement | null>> }
  /** Inclusive bounds for one segment, given what else is filled in. */
  rangeFor: (segment: DateSegment) => { min: number; max: number }
  setSegment: (segment: DateSegment, next: number | null) => void
  /** Arrow-key stepping, wrapping at the ends. */
  step: (segment: DateSegment, delta: number) => void
  /** Feed one typed digit into a segment; auto-advances when it cannot take more. */
  typeDigit: (segment: DateSegment, digit: string) => void
  /** Clear one segment. */
  clearSegment: (segment: DateSegment) => void
  /** Clear the whole field. */
  clear: () => void
  /** Move focus by `delta` segments, clamped at the ends. */
  moveFocus: (from: DateSegment, delta: number) => void
  focusSegment: (segment: DateSegment) => void
  handleSegmentFocus: (segment: DateSegment, event: FocusEvent<HTMLElement>) => void
  handleBlur: (event: FocusEvent<HTMLElement>) => void
}

/**
 * Headless state for a segmented date field: what is typed, where focus is, the
 * digit-entry buffer, and the locale-driven layout. Exported so a consumer can
 * build a completely custom renderer without reimplementing the fiddly parts —
 * type-ahead with auto-advance and day re-clamping especially.
 */
export function useDateInput(options: UseDateInputOptions): UseDateInputResult {
  const {
    value: valueProp,
    defaultValue = null,
    onChange,
    onPartsChange,
    min: minProp,
    max: maxProp,
    emitOutOfRange = true,
    locale,
    disabled = false,
    readOnly = false,
    onBlur,
    onFocus,
    onWarn,
    id: idProp,
  } = options

  const reactId = useId()
  const baseId = idProp ?? `rdi-${reactId}`

  // A range no date can satisfy is dropped entirely rather than enforced — a
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
  const [parts, setParts] = useState<DateParts>(
    () => (isControlled ? fromISO(valueProp ?? '') : fromISO(defaultValue ?? '')) ?? EMPTY_PARTS,
  )

  /**
   * Re-sync from a controlled `value` when the *prop* changes.
   *
   * Adjusting state during render rather than in an effect, which is React's
   * documented pattern for this: an effect would paint the stale segments for
   * one frame first. Comparing against the previous prop rather than against
   * the current segments is deliberate — mid-entry the segments have no ISO
   * form at all, and a comparison against `null` would wipe them on every
   * keystroke.
   */
  const [previousValueProp, setPreviousValueProp] = useState(valueProp)
  if (isControlled && valueProp !== previousValueProp) {
    setPreviousValueProp(valueProp)
    setParts(fromISO(valueProp ?? '') ?? EMPTY_PARTS)
  }

  const [focused, setFocused] = useState<DateSegment | null>(null)
  const segmentRefs = useRef<Partial<Record<DateSegment, HTMLElement | null>>>({})
  /** Digits typed so far in the segment being typed into. Cleared on focus change. */
  const buffer = useRef<{ segment: DateSegment; digits: string } | null>(null)

  const pieces = useMemo(() => datePieces(locale), [locale])
  const order = useMemo(
    () => pieces.flatMap((piece) => (piece.kind === 'segment' ? [piece.type] : [])),
    [pieces],
  )
  const months = useMemo(() => monthNames(locale), [locale])

  const value = toISO(parts)
  const complete = isComplete(parts)
  const outOfRange = value !== null && !withinRange(value, min, max)

  const ids = useMemo(
    () => ({
      group: baseId,
      hidden: `${baseId}-value`,
      day: `${baseId}-day`,
      month: `${baseId}-month`,
      year: `${baseId}-year`,
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
    const emit = (warning: DateWarning | null) => {
      if (!warning) return
      const key = `${warning.code}:${warning.received}`
      if (seen.has(key)) return
      seen.add(key)
      if (onWarn) onWarn(warning)
      // The library ships no console noise in production; this line is only
      // reached in development and is dropped from production builds.
      // eslint-disable-next-line no-console
      else console.warn(`[react-date-input] ${warning.message}`)
    }

    const raw = isControlled ? valueProp : defaultValue
    if (raw !== null && raw !== '') {
      emit(inspectValue(raw, isControlled ? 'value' : 'defaultValue'))
    }
    if (minProp !== undefined) emit(inspectBound(minProp, 'min'))
    if (maxProp !== undefined) emit(inspectBound(maxProp, 'max'))
    emit(inspectRange(minProp, maxProp))
    if (locale !== undefined) emit(inspectLocale(locale))
    if (value !== null) emit(inspectOutOfRange(value, min, max))
  }, [isControlled, valueProp, defaultValue, minProp, maxProp, locale, value, min, max, onWarn])

  const rangeFor = useCallback((segment: DateSegment) => segmentRange(segment, parts), [parts])

  /**
   * Apply a segment edit and report it.
   *
   * `onChange` fires only when the *committed* ISO value changes, so a parent
   * never sees a half-typed date; `onPartsChange` is the per-keystroke channel
   * for anyone who wants one.
   */
  /**
   * The last ISO value handed to `onChange`, so an edit that does not change
   * the committed date stays silent.
   */
  const lastEmitted = useRef<string | null>(toISO(parts))
  const emit = useCallback(
    (next: DateParts) => {
      const iso = toISO(next)
      if (iso === lastEmitted.current) return
      lastEmitted.current = iso
      // An out-of-range date is still reported by default: silently swallowing
      // what the user typed leaves them staring at a field that looks accepted
      // and a form that will not submit, with nothing connecting the two.
      onChange?.(iso !== null && !emitOutOfRange && !withinRange(iso, min, max) ? null : iso)
    },
    [onChange, emitOutOfRange, min, max],
  )

  /**
   * Apply a segment edit and report it.
   *
   * `provisional` means "a digit landed but the number is not finished". Typing
   * a year one digit at a time passes through 1, 19 and 199 on the way to 1999,
   * and each of those is a *complete* date if the other segments are filled —
   * so an unconditional emit reports `0001-03-15` to the parent, and any form
   * that saves on change persists it. The provisional edits update the display
   * and `onPartsChange`; `onChange` waits for `flush`.
   */
  const commit = useCallback(
    (next: DateParts, provisional = false) => {
      if (disabled || readOnly) return
      const clamped = clampDay(next)
      setParts(clamped)
      onPartsChange?.(clamped)
      if (!provisional) emit(clamped)
    },
    [disabled, readOnly, onPartsChange, emit],
  )

  /**
   * Report whatever is currently typed, if it differs from the last report.
   *
   * Reads `parts` from the closure rather than from a ref: writing a ref during
   * render is exactly what React's compiler rules forbid, and the callbacks
   * that call this are recreated when `parts` changes anyway.
   */
  const flush = useCallback(() => {
    if (disabled || readOnly) return
    emit(parts)
  }, [disabled, readOnly, emit, parts])

  const focusSegment = useCallback((segment: DateSegment) => {
    segmentRefs.current[segment]?.focus()
  }, [])

  const moveFocus = useCallback(
    (from: DateSegment, delta: number) => {
      const index = order.indexOf(from)
      // Clamped, not wrapped. Tab is the control for leaving the field; an
      // arrow key that jumped from the last segment back to the first would
      // make the field a trap you cannot arrow out of.
      const next = order[Math.min(order.length - 1, Math.max(0, index + delta))]
      if (next !== undefined && next !== from) focusSegment(next)
    },
    [order, focusSegment],
  )

  const setSegment = useCallback(
    (segment: DateSegment, next: number | null) => {
      buffer.current = null
      commit({ ...parts, [segment]: next })
    },
    [commit, parts],
  )

  /**
   * The value an empty segment starts from when the user presses an arrow key.
   *
   * Day and month start at 1. Year starts at the current one, which is the only
   * place in this package that reads the clock — and it reads it as "which year
   * is it", never as a date, so no timezone can shift it into the wrong day.
   */
  const startValue = useCallback((segment: DateSegment): number => {
    if (segment === 'year') return new Date().getFullYear()
    return 1
  }, [])

  const step = useCallback(
    (segment: DateSegment, delta: number) => {
      buffer.current = null
      const { min: low, max: high } = segmentRange(segment, parts)
      const current = parts[segment]
      const next =
        current === null
          ? // First press lands on the start value rather than one step past
            // it, so ArrowUp on an empty day gives 1 and not 2.
            Math.min(high, Math.max(low, startValue(segment)))
          : wrap(current + delta, low, high)
      commit({ ...parts, [segment]: next })
    },
    [parts, commit, startValue],
  )

  const typeDigit = useCallback(
    (segment: DateSegment, digit: string) => {
      if (disabled || readOnly) return
      const { min: low, max: high } = segmentRange(segment, parts)
      const width = segmentWidth(segment)
      const previous = buffer.current?.segment === segment ? buffer.current.digits : ''

      let digits = previous + digit
      let next = Number(digits)
      // Overflowing restarts from the new digit rather than rejecting it:
      // typing 1 then 9 into a month means the user changed their mind and
      // wants September, not that they meant 19.
      if (next > high) {
        digits = digit
        next = Number(digit)
      }

      // A lone leading zero is a legitimate intermediate state for a two-digit
      // segment (`0` on the way to `05`), but it is not a value — so it is held
      // in the buffer without being committed.
      if (next < low) {
        buffer.current = { segment, digits }
        return
      }

      buffer.current = { segment, digits }

      // The number is finished when no further digit could keep it in range —
      // after `3` in a month, after `31` in a day, after four digits in a year.
      const finished = digits.length >= width || next * 10 > high
      commit({ ...parts, [segment]: next }, !finished)

      if (finished) {
        buffer.current = null
        moveFocus(segment, 1)
      }
    },
    [disabled, readOnly, parts, commit, moveFocus],
  )

  const clearSegment = useCallback(
    (segment: DateSegment) => {
      buffer.current = null
      commit({ ...parts, [segment]: null })
    },
    [commit, parts],
  )

  const clear = useCallback(() => {
    buffer.current = null
    commit(EMPTY_PARTS)
  }, [commit])

  const handleSegmentFocus = useCallback(
    (segment: DateSegment, event: FocusEvent<HTMLElement>) => {
      // A fresh segment starts a fresh number. Without this, tabbing away
      // mid-entry and back would append to digits typed a minute ago. Leaving
      // a half-typed number also settles it, so a year abandoned at `199` is
      // reported rather than silently withheld.
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
   * halfway through the date.
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
    months,
    focused,
    min,
    max,
    disabled,
    readOnly,
    ids,
    segmentRefs,
    rangeFor,
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
