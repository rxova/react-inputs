import {
  REFUSED_UNITS,
  compareMeasurements,
  compareUnitSize,
  dimensionOf,
  fitsUnits,
  isCarryPair,
  isMeasurementUnit,
  isSigned,
  parseMeasurement,
  ratioBetween,
  usablePrecision,
} from './units'
import type { MeasurementUnit } from './units'
import type { MeasurementWarning } from './types'

/**
 * Development-only diagnostics.
 *
 * Every function here is reached exclusively from the `NODE_ENV !== 'production'`
 * branch in `useMeasurementInput`, so a production bundler drops this whole
 * module. The coercion itself lives in the hook and always runs; this only
 * *describes* a coercion that already happened.
 */

/** The suffix every message ends with when a value could not be read at all. */
const SHAPE_HINT =
  'It must be an amount and an `Intl` unit identifier: `"71 inch"`, `"180 centimeter"`, `"36.6 celsius"`.'

/**
 * Quote a value for a message without letting a non-string throw on the way.
 *
 * Both fallbacks are reachable from real props: `JSON.stringify(undefined)` is
 * `undefined`, and a circular object makes it throw. A diagnostic that blows up
 * while explaining a bad prop is the worst of both.
 */
function show(received: unknown): string {
  if (typeof received === 'string') return received
  try {
    // Typed `unknown` on purpose: the lib says `JSON.stringify` returns a
    // string, and it returns `undefined` for `undefined`, a function or a
    // symbol — all three of which a loosely-typed form library can hand over.
    const json: unknown = JSON.stringify(received)
    return typeof json === 'string' ? json : String(received)
  } catch {
    return String(received)
  }
}

/** Why a refused-but-real `Intl` unit is refused, and what to reach for instead. */
function refusalHint(unit: string): string {
  return REFUSED_UNITS[unit] === 'time'
    ? `"${unit}" is a time unit. Durations are a different value with a different canonical form — use \`@rxova/react-duration-input\`, which speaks ISO 8601.`
    : `"${unit}" has no conversion partner in \`Intl\`'s unit list, so there is nothing for a converting field to convert it to.`
}

/**
 * Describe a `value` / `defaultValue` this field cannot hold.
 *
 * Five outcomes rather than one, because they call for five different fixes and
 * the caller can act on each. A bare number is the commonest: most of the
 * ecosystem stores a measurement as a number with the unit implied somewhere
 * else, and that implication is exactly what this component exists to remove.
 */
export function inspectValue(
  received: unknown,
  prop: string,
  units: readonly MeasurementUnit[],
): MeasurementWarning | null {
  const raw = show(received)
  const parsed = parseMeasurement(raw)

  if (parsed.ok) {
    const target = units[units.length - 1]
    if (target === undefined) return null
    if (dimensionOf(parsed.unit) === dimensionOf(target)) return null
    return {
      code: 'value-dimension-mismatch',
      prop,
      received: raw,
      message: `\`${prop}\` is "${raw}", which is a ${String(dimensionOf(parsed.unit))} — this field edits ${String(dimensionOf(target))}. There is no conversion between the two, so the field is left empty rather than inventing one.`,
    }
  }

  if (parsed.error === 'time-unit' || parsed.error === 'no-partner') {
    return {
      code: parsed.error === 'time-unit' ? 'value-time-unit' : 'value-no-partner',
      prop,
      received: raw,
      message: `\`${prop}\` is "${raw}". ${refusalHint(parsed.unit)} Rendering an empty field.`,
    }
  }

  if (parsed.error === 'unknown-unit') {
    return {
      code: 'value-unknown-unit',
      prop,
      received: raw,
      message: `\`${prop}\` is "${raw}", and "${parsed.unit}" is not a unit this field converts. Units are \`Intl\` identifiers — "centimeter", not "cm"; "fluid-ounce", not "floz". Rendering an empty field.`,
    }
  }

  const looksNumeric = /^-?\d+(\.\d+)?$/.test(raw.trim())
  const target = units[units.length - 1]
  const hint =
    looksNumeric && target !== undefined
      ? `\`${prop}\` is "${raw}", which is a bare number with no unit. That is the ambiguity this field exists to remove — write "${raw.trim()} ${target}" if that is what you meant.`
      : `\`${prop}\` could not be read; received "${raw}". ${SHAPE_HINT}`

  return {
    code: 'value-unparseable',
    prop,
    received: raw,
    message: `${hint} Rendering an empty field.`,
  }
}

/**
 * Describe a value the visible units cannot hold exactly.
 *
 * `"1.81 meter"` in a feet-and-inches field is 71.26 inches, and the field shows
 * 71. Refusing the value outright would be worse — but the loss is invisible
 * from the outside, and a form that round-trips it writes back a different
 * measurement than it read.
 */
export function inspectTruncation(
  raw: string,
  units: readonly MeasurementUnit[],
  precision: number,
  prop: string,
): MeasurementWarning | null {
  const smallest = units[units.length - 1]
  if (smallest === undefined || fitsUnits(raw, units, precision)) return null
  return {
    code: 'value-truncated',
    prop,
    received: raw,
    message: `\`${prop}\` is "${raw}", which is finer than this field can show. It is rounded to ${precision === 0 ? `whole ${smallest}s` : `${String(precision)} decimal place(s) of ${smallest}`}, so reading the value back will not return "${raw}". Raise \`precision\`, or add a smaller unit to \`units\`.`,
  }
}

/** Describe a `min` or `max` that is not a measurement. */
export function inspectBound(raw: string, prop: 'min' | 'max'): MeasurementWarning | null {
  if (parseMeasurement(raw).ok) return null
  return {
    code: prop === 'min' ? 'min-unparseable' : 'max-unparseable',
    prop,
    received: raw,
    message: `\`${prop}\` could not be read; received "${raw}". ${SHAPE_HINT} Ignoring it.`,
  }
}

/**
 * Describe a range no measurement can satisfy.
 *
 * Compared through {@link compareMeasurements}, never with `<`. The bounds may
 * be written in different units from each other and from the field — `min="1
 * meter" max="80 inch"` is a perfectly good range that a string comparison
 * would reject, which is exactly the bug this component exists not to have.
 */
export function inspectRange(
  min: string | undefined,
  max: string | undefined,
): MeasurementWarning | null {
  if (min === undefined || max === undefined) return null
  const order = compareMeasurements(min, max)
  if (order === null) {
    // Two readable bounds in different dimensions. Neither is wrong on its own,
    // and together they are unenforceable.
    if (!parseMeasurement(min).ok || !parseMeasurement(max).ok) return null
    return {
      code: 'min-after-max',
      prop: 'min',
      received: min,
      message: `\`min\` (${min}) and \`max\` (${max}) measure different things, so no value can be checked against both. Ignoring both bounds.`,
    }
  }
  if (order <= 0) return null
  return {
    code: 'min-after-max',
    prop: 'min',
    received: min,
    message: `\`min\` (${min}) is larger than \`max\` (${max}); no measurement can satisfy both. Ignoring both bounds.`,
  }
}

/** Describe a completed measurement that falls outside the allowed range. */
export function inspectOutOfRange(
  value: string,
  min: string | undefined,
  max: string | undefined,
): MeasurementWarning | null {
  if (min !== undefined && (compareMeasurements(value, min) ?? 0) < 0) {
    return {
      code: 'value-out-of-range',
      prop: 'value',
      received: value,
      message: `\`value\` (${value}) is smaller than \`min\` (${min}). The field is marked invalid.`,
    }
  }
  if (max !== undefined && (compareMeasurements(value, max) ?? 0) > 0) {
    return {
      code: 'value-out-of-range',
      prop: 'value',
      received: value,
      message: `\`value\` (${value}) is larger than \`max\` (${max}). The field is marked invalid.`,
    }
  }
  return null
}

/**
 * Describe a `units` array that had to be repaired.
 *
 * Every repair here is silent by nature — a reordered or shortened array still
 * renders a working field — so the warning is the only way to notice that
 * `['meter', 'inch']` was not honoured as written.
 */
export function inspectUnits(units: readonly unknown[]): MeasurementWarning | null {
  const received = JSON.stringify(units)

  const refused = units.filter(
    (unit): unit is string => typeof unit === 'string' && REFUSED_UNITS[unit] !== undefined,
  )
  const firstRefused = refused[0]
  if (firstRefused !== undefined) {
    return {
      code: 'units-not-convertible',
      prop: 'units',
      received,
      message: `\`units\` contains "${firstRefused}". ${refusalHint(firstRefused)} Dropping it.`,
    }
  }

  const unknownUnits = units.filter((unit) => !isMeasurementUnit(unit))
  const firstUnknown = unknownUnits[0]
  if (firstUnknown !== undefined) {
    return {
      code: 'units-invalid',
      prop: 'units',
      received,
      message: `\`units\` contains ${show(firstUnknown)}, which is not a unit this field converts. Units are \`Intl\` identifiers — "centimeter", not "cm". Dropping it.`,
    }
  }

  const known = units as readonly MeasurementUnit[]
  const [first] = known
  if (first === undefined) {
    return {
      code: 'units-invalid',
      prop: 'units',
      received: '[]',
      message: `\`units\` is empty, which would render a field with nothing to type into. Using ['meter', 'centimeter'].`,
    }
  }

  const dimension = dimensionOf(first)
  const foreign = known.find((unit) => dimensionOf(unit) !== dimension)
  if (foreign !== undefined) {
    return {
      code: 'units-dimension-mixed',
      prop: 'units',
      received,
      message: `\`units\` mixes ${String(dimension)} with ${String(dimensionOf(foreign))} ("${foreign}"). One field edits one kind of quantity; there is no conversion across the two. Keeping the ${String(dimension)} units.`,
    }
  }

  if (dimension !== null && isSigned(dimension) && known.length > 1) {
    return {
      code: 'units-temperature-multi',
      prop: 'units',
      received,
      message: `\`units\` is ${received}. A temperature is a point on a scale, not a sum of parts — "3 °C 20 °F" is two temperatures, not one. Keeping only "${first}".`,
    }
  }

  const ordered = [...new Set(known)].sort(compareUnitSize)
  for (let index = 1; index < ordered.length; index++) {
    const previous = ordered[index - 1]
    const unit = ordered[index]
    /* v8 ignore next */
    if (previous === undefined || unit === undefined) continue
    if (isCarryPair(previous, unit)) continue
    return {
      code: 'units-ratio-not-integer',
      prop: 'units',
      received,
      message: `\`units\` puts "${unit}" under "${previous}", and one ${previous} is ${String(ratioBetween(previous, unit))} ${unit}s — not a whole number. A segment carries into the one above it when it overflows, and there is no point at which this one would overflow. Dropping "${unit}".`,
    }
  }

  if (ordered.length === known.length && ordered.every((unit, index) => known[index] === unit)) {
    return null
  }
  return {
    code: 'units-invalid',
    prop: 'units',
    received,
    message: `\`units\` is ${received}; rendering ${JSON.stringify(ordered)} instead. A measurement is written largest-unit-first, and the largest unit on screen is the unbounded one — reversing them would put a bounded segment ahead of an open-ended one.`,
  }
}

/** Describe a `precision` outside the 0–6 whole-number range. */
export function inspectPrecision(precision: number): MeasurementWarning | null {
  if (usablePrecision(precision) === precision) return null
  return {
    code: 'precision-invalid',
    prop: 'precision',
    received: String(precision),
    message: `\`precision\` must be a whole number from 0 to 6; received ${String(precision)}. Using 0. Beyond six places a decimal measurement is below the resolution of a double anyway.`,
  }
}

/**
 * Describe a step the smallest segment cannot land on.
 *
 * A step of `0.25` in a field showing one decimal place would walk from 0 to
 * 0.25 — a value that segment cannot display, so the number on screen and the
 * number in the value would disagree on the first arrow press.
 */
export function inspectStep(step: number, precision: number): MeasurementWarning | null {
  const places = usablePrecision(precision)
  if (Number.isFinite(step) && step > 0 && Number(step.toFixed(places)) === step) return null
  return {
    code: 'step-invalid',
    prop: 'step',
    received: String(step),
    message: `\`step\` must be a positive number the smallest segment can land on at \`precision\` ${String(places)}; received ${String(step)}. Using ${String(Number((10 ** -places).toFixed(places)))}.`,
  }
}

/** Describe a locale tag `Intl` refused. */
export function inspectLocale(locale: string): MeasurementWarning | null {
  try {
    new Intl.NumberFormat(locale)
    return null
  } catch {
    return {
      code: 'locale-invalid',
      prop: 'locale',
      received: locale,
      message: `\`locale\` "${locale}" is not a valid BCP 47 tag (note the hyphen: "en-US", not "en_US"). Falling back to the runtime's own locale.`,
    }
  }
}
