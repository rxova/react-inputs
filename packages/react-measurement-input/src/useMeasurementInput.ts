import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { FocusEvent } from 'react'
import {
  EMPTY_PARTS,
  boundsUsable,
  clamp,
  defaultPlaceholder,
  formatSegment,
  fromMeasurement,
  isComplete,
  isSigned,
  normalise,
  partOf,
  partsToAmount,
  quantum,
  roundTo,
  toBaseUnit,
  toMeasurement,
  unitRange,
  unitWidth,
  usablePrecision,
  withinMeasurementRange,
} from './units'
import type { Dimension, MeasurementParts, MeasurementUnit } from './units'
import { dimensionOfUnits, measurementPieces, unitName, usableUnits } from './segments'
import type { MeasurementPiece } from './segments'
import {
  inspectBound,
  inspectLocale,
  inspectOutOfRange,
  inspectPrecision,
  inspectRange,
  inspectStep,
  inspectTruncation,
  inspectUnits,
  inspectValue,
} from './warn'
import type { MeasurementWarning } from './types'

/** What a field shows when `units` is not given: a metric height. */
export const DEFAULT_MEASUREMENT_UNITS: readonly MeasurementUnit[] = ['meter', 'centimeter']

export interface UseMeasurementInputOptions {
  value?: string | null
  defaultValue?: string | null
  onChange?: (value: string | null) => void
  onPartsChange?: (parts: MeasurementParts) => void
  min?: string
  max?: string
  emitOutOfRange?: boolean
  units?: MeasurementUnit[]
  precision?: number
  step?: number
  locale?: string
  disabled?: boolean
  readOnly?: boolean
  onBlur?: (event: FocusEvent<HTMLElement>) => void
  onFocus?: (event: FocusEvent<HTMLElement>) => void
  onWarn?: (warning: MeasurementWarning) => void
  id?: string
}

export interface UseMeasurementInputResult {
  /** What is currently typed, per unit. Units the field does not show stay absent. */
  parts: MeasurementParts
  /** `"<amount> <unit>"` in the smallest unit on screen, or `null` when incomplete. */
  value: string | null
  /** The same measurement counted in the smallest unit on screen. */
  amount: number | null
  /** The same measurement in the dimension's base unit — metres, kilograms, litres. */
  base: number | null
  complete: boolean
  /** Complete, but outside `min`/`max`. */
  outOfRange: boolean
  /** The units and suffixes, in display order. */
  pieces: MeasurementPiece[]
  /** The units this field edits, largest first. Coerced from the `units` prop. */
  units: MeasurementUnit[]
  /** What kind of quantity this field measures. */
  dimension: Dimension | null
  /** Decimal places the smallest segment carries. Coerced from the `precision` prop. */
  precision: number
  /** The unit that currently has focus. */
  focused: MeasurementUnit | null
  min: string | undefined
  max: string | undefined
  disabled: boolean
  readOnly: boolean
  ids: { group: string; hidden: string }
  /** The DOM id of one segment. */
  idFor: (unit: MeasurementUnit) => string
  /**
   * Structural rather than `RefObject`: in @types/react 18 `RefObject.current`
   * is readonly, in 19 it is mutable. Declaring the shape keeps this assignable
   * under both, which matters because `react >= 18` is a peer.
   */
  segmentRefs: { current: Partial<Record<MeasurementUnit, HTMLElement | null>> }
  /** Inclusive bounds for one segment. `Infinity` on an end that has none. */
  rangeFor: (unit: MeasurementUnit) => { min: number; max: number }
  /** The locale's accessible name for a unit. */
  nameFor: (unit: MeasurementUnit) => string
  /** What a segment paints right now — mid-entry text, the value, or a placeholder. */
  textFor: (unit: MeasurementUnit, placeholder?: string) => string
  setSegment: (unit: MeasurementUnit, next: number | null) => void
  /** Arrow-key stepping. Clamps rather than wraps — see the note on `step`. */
  step: (unit: MeasurementUnit, delta: number) => void
  /** Feed one typed character into a segment: a digit, a decimal mark, or a sign. */
  typeCharacter: (unit: MeasurementUnit, key: string) => void
  clearSegment: (unit: MeasurementUnit) => void
  clear: () => void
  moveFocus: (from: MeasurementUnit, delta: number) => void
  focusSegment: (unit: MeasurementUnit) => void
  handleSegmentFocus: (unit: MeasurementUnit, event: FocusEvent<HTMLElement>) => void
  handleBlur: (event: FocusEvent<HTMLElement>) => void
}

/** Digits typed so far, and the controlled value they were typed against. */
interface Entry {
  unit: MeasurementUnit
  /** The raw characters, so `-` and a trailing `.` survive until the next key. */
  text: string
  basis: string | null | undefined
}

/** Coerce the `step` prop to something the smallest segment can land on. */
function usableStep(step: number | undefined, precision: number): number {
  const fallback = quantum(precision)
  if (step === undefined) return fallback
  return Number.isFinite(step) && step > 0 && roundTo(step, precision) === step ? step : fallback
}

/** The integer and fractional halves of a typed number, sign removed. */
function split(text: string): { sign: string; whole: string; fraction: string | undefined } {
  const sign = text.startsWith('-') ? '-' : ''
  const [whole = '', fraction] = text.slice(sign.length).split('.')
  return { sign, whole, fraction }
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
 * Headless state for a segmented measurement field: what is typed, where focus
 * is, the character-entry buffer, and the unit layout. Exported so a consumer
 * can build a completely custom renderer without reimplementing the fiddly
 * parts — the unbounded leading unit, the carry on blur, decimal entry on the
 * smallest segment, and type-ahead with auto-advance especially.
 */
export function useMeasurementInput(
  options: UseMeasurementInputOptions,
): UseMeasurementInputResult {
  const {
    value: valueProp,
    defaultValue = null,
    onChange,
    onPartsChange,
    min: minProp,
    max: maxProp,
    emitOutOfRange = true,
    units: unitsProp,
    precision: precisionProp = 0,
    step: stepProp,
    locale,
    disabled = false,
    readOnly = false,
    onBlur,
    onFocus,
    onWarn,
    id: idProp,
  } = options

  const reactId = useId()
  const baseId = idProp ?? `rx-measurement-${reactId}`

  const units = useMemo(() => usableUnits(unitsProp, DEFAULT_MEASUREMENT_UNITS), [unitsProp])
  const dimension = dimensionOfUnits(units)
  const precision = usablePrecision(precisionProp)
  const stepSize = usableStep(stepProp, precision)
  const smallest = units[units.length - 1]

  // A range no measurement can satisfy is dropped entirely rather than enforced
  // — a field nothing can be entered into is worse than a missing bound. The
  // bounds may be written in any unit of the dimension, so they are compared
  // through `compareMeasurements`, never as strings.
  const usable = boundsUsable(minProp, maxProp)
  const min = usable ? minProp : undefined
  const max = usable ? maxProp : undefined

  const isControlled = valueProp !== undefined
  const [parts, setParts] = useState<MeasurementParts>(
    () =>
      (isControlled
        ? fromMeasurement(valueProp ?? '', units, precision)
        : fromMeasurement(defaultValue ?? '', units, precision)) ?? EMPTY_PARTS,
  )

  /**
   * Characters typed so far in the segment being typed into.
   *
   * Held in a ref *and* in state, written only through `setEntry`. The ref is
   * what the handlers read, synchronously, before React has re-rendered; the
   * state is what the segment paints, so a lone `-` or a trailing `.` is
   * visible instead of vanishing until the next keystroke completes a number.
   */
  const entryRef = useRef<Entry | null>(null)
  const [entry, setEntryState] = useState<Entry | null>(null)

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
  const valueArrived = isControlled && valueProp !== previousValueProp
  if (valueArrived) {
    setPreviousValueProp(valueProp)
    setParts(fromMeasurement(valueProp ?? '', units, precision) ?? EMPTY_PARTS)
  }

  /**
   * Re-shape the segments when `units` or `precision` changes under a value
   * that is already there.
   *
   * Without this, a metric/imperial toggle — the first thing anyone builds with
   * this component — silently erases what the user typed: the segments are keyed
   * by unit, so `{ foot: 5, inch: 11 }` is simply absent from a metres-and-
   * centimetres field and the height disappears. The measurement is converted
   * instead, through the canonical value the *old* units produced.
   *
   * Keyed on the units' contents rather than the array's identity, because
   * `units={['foot', 'inch']}` written inline is a new array on every render and
   * comparing identity would reset the field continuously.
   *
   * Nothing is emitted here. A controlled parent asked for different units, not
   * for a different value, and firing `onChange` from render is not allowed
   * anyway; the next edit or blur reports the canonical value in the new units.
   */
  const shape = `${units.join(',')}/${String(precision)}`
  const [previousShape, setPreviousShape] = useState({ key: shape, units, precision })
  if (shape !== previousShape.key) {
    setPreviousShape({ key: shape, units, precision })
    // Unless a new `value` landed in the same render — that branch already
    // rebuilt the segments from the new units, and it is the parent's
    // instruction rather than our inference.
    if (!valueArrived) {
      const carried = toMeasurement(parts, previousShape.units, previousShape.precision)
      setParts(
        carried === null
          ? EMPTY_PARTS
          : (fromMeasurement(carried, units, precision) ?? EMPTY_PARTS),
      )
    }
  }

  const setEntry = useCallback(
    (next: { unit: MeasurementUnit; text: string } | null) => {
      const stamped = next === null ? null : { ...next, basis: previousValueProp }
      entryRef.current = stamped
      setEntryState(stamped)
    },
    [previousValueProp],
  )

  /**
   * The buffer, unless a controlled `value` has landed since it was filled.
   *
   * A half-typed number belongs to the segment it was typed into, and a value
   * arriving from outside replaces that segment. Keeping the characters lets
   * the next keystroke extend a number that is no longer on screen: type `1`
   * into the centimetres, let the parent write a new height, type `5`, and the
   * centimetres become 15 — a number the user never typed.
   *
   * Clearing the ref inside the re-sync above would be a ref write during
   * render, which React forbids. Stamping the buffer with the prop it was typed
   * against and checking that stamp here is the same guarantee, synchronously,
   * from the handlers that actually read it.
   */
  const liveEntry = useCallback(
    () => (entryRef.current?.basis === previousValueProp ? entryRef.current : null),
    [previousValueProp],
  )

  const [focused, setFocused] = useState<MeasurementUnit | null>(null)
  const segmentRefs = useRef<Partial<Record<MeasurementUnit, HTMLElement | null>>>({})

  const pieces = useMemo(() => measurementPieces(units, locale), [units, locale])

  const value = toMeasurement(parts, units, precision)
  const complete = isComplete(parts, units)
  const amount = complete ? partsToAmount(parts, units, precision) : null
  const base = value === null ? null : toBaseUnit(value)
  const outOfRange = value !== null && !withinMeasurementRange(value, min, max)

  const ids = useMemo(() => ({ group: baseId, hidden: `${baseId}-value` }), [baseId])
  const idFor = useCallback((unit: MeasurementUnit) => `${baseId}-${unit}`, [baseId])

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
    const emit = (warning: MeasurementWarning | null) => {
      if (!warning) return
      const key = `${warning.code}:${warning.received}`
      if (seen.has(key)) return
      seen.add(key)
      if (onWarn) {
        notify(() => {
          onWarn(warning)
        })
      }
      // The library ships no console noise in production; this line is only
      // reached in development and is dropped from production builds.
      // eslint-disable-next-line no-console
      else console.warn(`[react-measurement-input] ${warning.message}`)
    }

    const raw = isControlled ? valueProp : defaultValue
    const prop = isControlled ? 'value' : 'defaultValue'
    if (raw !== null && raw !== '') {
      emit(inspectValue(raw, prop, units))
      emit(inspectTruncation(raw, units, precision, prop))
    }
    if (minProp !== undefined) emit(inspectBound(minProp, 'min'))
    if (maxProp !== undefined) emit(inspectBound(maxProp, 'max'))
    emit(inspectRange(minProp, maxProp))
    if (unitsProp !== undefined) emit(inspectUnits(unitsProp))
    emit(inspectPrecision(precisionProp))
    if (stepProp !== undefined) emit(inspectStep(stepProp, precisionProp))
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
    precisionProp,
    precision,
    stepProp,
    locale,
    value,
    min,
    max,
    onWarn,
  ])

  const rangeFor = useCallback(
    (unit: MeasurementUnit) => unitRange(unit, units, precision),
    [units, precision],
  )

  const nameFor = useCallback(
    (unit: MeasurementUnit) => unitName(unit, locale) ?? unit.replace(/-/g, ' '),
    [locale],
  )

  const textFor = useCallback(
    (unit: MeasurementUnit, placeholder?: string) => {
      if (entry !== null && entry.unit === unit && entry.basis === previousValueProp) {
        return entry.text
      }
      const current = partOf(parts, unit)
      if (current === null) return placeholder ?? defaultPlaceholder(unit, units, precision)
      return formatSegment(current, unit, units, precision)
    },
    [entry, previousValueProp, parts, units, precision],
  )

  const lastEmitted = useRef<string | null>(toMeasurement(parts, units, precision))

  const emitChange = useCallback(
    (next: MeasurementParts) => {
      const canonical = toMeasurement(next, units, precision)
      if (canonical === lastEmitted.current) return
      lastEmitted.current = canonical
      // An out-of-range measurement is still reported by default: silently
      // swallowing what the user typed leaves them staring at a field that
      // looks accepted and a form that will not submit, with nothing connecting
      // the two.
      onChange?.(
        canonical !== null && !emitOutOfRange && !withinMeasurementRange(canonical, min, max)
          ? null
          : canonical,
      )
    },
    [onChange, units, precision, emitOutOfRange, min, max],
  )

  /**
   * Apply an edit and report it.
   *
   * `provisional` means "a character landed but the number is not finished".
   * Typing `15` into centimetres passes through `1`, and with the metres filled
   * that is already a complete measurement — so an unconditional emit reports
   * one centimetre on the way to fifteen, and a form that saves on change
   * persists it.
   */
  const commit = useCallback(
    (next: MeasurementParts, provisional = false) => {
      if (disabled || readOnly) return
      setParts(next)
      if (onPartsChange) {
        notify(() => {
          onPartsChange(next)
        })
      }
      if (!provisional) emitChange(next)
    },
    [disabled, readOnly, onPartsChange, emitChange],
  )

  const withSegment = useCallback(
    (unit: MeasurementUnit, next: number | null): MeasurementParts => ({ ...parts, [unit]: next }),
    [parts],
  )

  const setSegment = useCallback(
    (unit: MeasurementUnit, next: number | null) => {
      setEntry(null)
      commit(withSegment(unit, next))
    },
    [commit, withSegment, setEntry],
  )

  /**
   * Arrow-key stepping. Clamped, not wrapped.
   *
   * The time field wraps because a clock does: 23:59 plus a minute is 00:00. A
   * measurement has no such cycle. Arrowing down from `0 cm` to `99 cm` would
   * silently add a metre, and arrowing up past the leading segment's ceiling is
   * meaningless because there is none. So each segment stops at its own ends.
   */
  const step = useCallback(
    (unit: MeasurementUnit, delta: number) => {
      setEntry(null)
      const { min: low, max: high } = unitRange(unit, units, precision)
      const current = partOf(parts, unit)
      const size = unit === smallest ? stepSize : 1
      // First press lands on the start value rather than one step past it. A
      // temperature field has no floor to start from, so it starts at zero.
      const start = Number.isFinite(low) ? low : 0
      const next =
        current === null ? start : roundTo(clamp(current + delta * size, low, high), precision)
      commit(withSegment(unit, next))
    },
    [units, precision, parts, smallest, stepSize, commit, withSegment, setEntry],
  )

  const focusSegment = useCallback((unit: MeasurementUnit) => {
    segmentRefs.current[unit]?.focus()
  }, [])

  const moveFocus = useCallback(
    (from: MeasurementUnit, delta: number) => {
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
   * This is where `14` in the inches of a feet-and-inches field becomes
   * `1 ft 2 in`. It runs on blur and when focus leaves a segment, never
   * mid-keystroke — carrying while the user is still typing would move the
   * digits out from under them.
   */
  const flush = useCallback(() => {
    if (disabled || readOnly) return
    const settled = normalise(parts, units, precision)
    if (settled !== parts) setParts(settled)
    emitChange(settled)
  }, [disabled, readOnly, parts, units, precision, emitChange])

  /**
   * Feed one character into a segment.
   *
   * Bounded by *width*, never by the range. Bounding by the range makes the
   * carry — the whole point of a two-unit field — unreachable: with inches
   * capped at 11, a range-bounded segment refuses the `4` of `14` and
   * `1 ft 2 in` can never be typed.
   */
  const typeCharacter = useCallback(
    (unit: MeasurementUnit, key: string) => {
      if (disabled || readOnly) return

      const decimals = unit === smallest ? precision : 0
      const signed = units[0] === unit && dimension !== null && isSigned(dimension)
      const live = liveEntry()
      const previous = live?.unit === unit ? live.text : ''

      let text: string
      if (key === '-') {
        // A toggle rather than a prefix: someone who typed `5` and then wanted
        // −5 should not have to clear the segment first.
        if (!signed) return
        text = previous.startsWith('-') ? previous.slice(1) : `-${previous}`
      } else if (key === '.' || key === ',') {
        if (decimals === 0 || previous.includes('.')) return
        // A leading `.` means `0.`, so the segment never shows a bare point.
        text = `${previous === '' || previous === '-' ? `${previous}0` : previous}.`
      } else {
        const { sign, whole, fraction } = split(previous)
        if (fraction !== undefined) {
          if (fraction.length >= decimals) return
          text = previous + key
        } else if (whole.length >= unitWidth(unit, units, precision)) {
          // Overflowing restarts from the new character rather than rejecting
          // it: typing a third digit into a two-digit segment means the user
          // wants that digit.
          text = sign + key
        } else {
          text = previous + key
        }
      }

      const typed = Number(text)
      const next = Number.isFinite(typed) ? roundTo(typed, decimals) : null
      setEntry({ unit, text })

      const { whole, fraction } = split(text)
      // The leading segment has no ceiling, so "cannot take more" is purely
      // about width. A segment that accepts decimals is finished only once its
      // fraction is full, because a trailing `.` is still mid-number.
      const finished =
        decimals > 0
          ? fraction !== undefined && fraction.length >= decimals
          : whole.length >= unitWidth(unit, units, precision)
      commit(withSegment(unit, next), !finished)

      if (finished) {
        setEntry(null)
        moveFocus(unit, 1)
      }
    },
    [
      disabled,
      readOnly,
      units,
      precision,
      smallest,
      dimension,
      commit,
      withSegment,
      moveFocus,
      liveEntry,
      setEntry,
    ],
  )

  const clearSegment = useCallback(
    (unit: MeasurementUnit) => {
      setEntry(null)
      commit(withSegment(unit, null))
    },
    [commit, withSegment, setEntry],
  )

  const clear = useCallback(() => {
    setEntry(null)
    commit(EMPTY_PARTS)
  }, [commit, setEntry])

  const handleSegmentFocus = useCallback(
    (unit: MeasurementUnit, event: FocusEvent<HTMLElement>) => {
      // A fresh segment starts a fresh number, and leaving a half-typed one
      // settles it so a centimetre abandoned at `1` is reported rather than
      // withheld.
      const live = liveEntry()
      if (live !== null && live.unit !== unit) flush()
      setEntry(null)
      setFocused(unit)
      onFocus?.(event)
    },
    [onFocus, flush, liveEntry, setEntry],
  )

  /**
   * Only emit blur when focus genuinely leaves the field. Arrowing between
   * segments moves focus between siblings, and a naive per-segment onBlur marks
   * the field touched mid-entry — firing validation while the user is still
   * halfway through the measurement.
   */
  const handleBlur = useCallback(
    (event: FocusEvent<HTMLElement>) => {
      const next = event.relatedTarget
      if (next instanceof Node && event.currentTarget.contains(next)) return
      setEntry(null)
      setFocused(null)
      flush()
      onBlur?.(event)
    },
    [onBlur, flush, setEntry],
  )

  return {
    parts,
    value,
    amount,
    base,
    complete,
    outOfRange,
    pieces,
    units,
    dimension,
    precision,
    focused,
    min,
    max,
    disabled,
    readOnly,
    ids,
    idFor,
    segmentRefs,
    rangeFor,
    nameFor,
    textFor,
    setSegment,
    step,
    typeCharacter,
    clearSegment,
    clear,
    moveFocus,
    focusSegment,
    handleSegmentFocus,
    handleBlur,
  }
}
