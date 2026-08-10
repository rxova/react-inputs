/**
 * Unit conversion on plain numbers and `"<amount> <unit>"` strings.
 *
 * The date, time and duration fields all borrow their vocabulary from the
 * platform. This one can only borrow half of it: `Intl.supportedValuesOf('unit')`
 * sanctions the identifiers and `Intl.NumberFormat` writes them out per locale,
 * but **there is no `Intl` API that converts feet to metres**. So this module is
 * a table.
 *
 * That is defensible here in a way a bundled locale table would not be. These
 * are not conventions that drift with a CLDR release — they are exact legal
 * definitions, fixed by the 1959 international yard and pound agreement and
 * unchanged since: 1 inch ≡ 25.4 mm, 1 lb ≡ 0.45359237 kg, 1 US gallon ≡
 * 3.785411784 L. Thirty numbers, no dependency, and nothing to keep up to date.
 *
 * Two things this file exists to get right:
 *
 * 1. **Temperature is not a ratio.** °C → °F is `× 9/5 + 32`. A plain factor
 *    table — which is what every "units" helper is underneath — turns 100 °C
 *    into 100 °F and is silently, catastrophically wrong. Every unit here
 *    carries an offset as well as a factor, so one formula covers both kinds.
 * 2. **Binary floating point is not exact.** `0.3048 / 0.0254` is
 *    `12.000000000000002`, so an integer test on the raw quotient says feet and
 *    inches do not divide. Every result leaves this module through {@link tidy},
 *    which drops the noise below the twelfth significant digit — comfortably
 *    finer than any measurement a form collects, and coarser than the error.
 */

/** The families of unit this field converts within. Never across. */
export type Dimension = 'length' | 'mass' | 'volume' | 'area' | 'digital' | 'temperature'

interface UnitDefinition {
  readonly dimension: Dimension
  /** Multiplier onto the dimension's base unit, after `offset` is subtracted. */
  readonly factor: number
  /** Subtracted before scaling. Non-zero only where a scale has a shifted zero. */
  readonly offset: number
}

/**
 * Every unit this field edits, with its exact definition.
 *
 * Keys are `Intl` unit identifiers verbatim, so nothing new is invented: the
 * same string names the unit here, in the value, and in `Intl.NumberFormat`.
 *
 * The base unit of each dimension is the one with `factor: 1`.
 */
const UNITS = {
  // ---- length, base metre ---------------------------------------------------
  millimeter: { dimension: 'length', factor: 0.001, offset: 0 },
  centimeter: { dimension: 'length', factor: 0.01, offset: 0 },
  meter: { dimension: 'length', factor: 1, offset: 0 },
  kilometer: { dimension: 'length', factor: 1000, offset: 0 },
  // 1959 international agreement: the inch is exactly 25.4 mm, and the foot,
  // yard and mile are exact multiples of it.
  inch: { dimension: 'length', factor: 0.0254, offset: 0 },
  foot: { dimension: 'length', factor: 0.3048, offset: 0 },
  yard: { dimension: 'length', factor: 0.9144, offset: 0 },
  mile: { dimension: 'length', factor: 1609.344, offset: 0 },
  // The Scandinavian mil, which is exactly ten kilometres — not a rounding of
  // the statute mile, and `Intl` lists it separately for that reason.
  'mile-scandinavian': { dimension: 'length', factor: 10_000, offset: 0 },

  // ---- mass, base kilogram --------------------------------------------------
  gram: { dimension: 'mass', factor: 0.001, offset: 0 },
  kilogram: { dimension: 'mass', factor: 1, offset: 0 },
  // Avoirdupois. The pound is exactly 0.45359237 kg by the same 1959 agreement;
  // the ounce is a sixteenth of it and the stone fourteen of them.
  ounce: { dimension: 'mass', factor: 0.028349523125, offset: 0 },
  pound: { dimension: 'mass', factor: 0.45359237, offset: 0 },
  stone: { dimension: 'mass', factor: 6.35029318, offset: 0 },

  // ---- volume, base litre ---------------------------------------------------
  milliliter: { dimension: 'volume', factor: 0.001, offset: 0 },
  liter: { dimension: 'volume', factor: 1, offset: 0 },
  // US liquid measure, which is what `Intl` means by `gallon` and
  // `fluid-ounce`: the US gallon is exactly 3.785411784 L and holds 128 of
  // these fluid ounces. The imperial gallon is a different, larger unit and
  // `Intl` has no identifier for it, so this field cannot offer one.
  gallon: { dimension: 'volume', factor: 3.785411784, offset: 0 },
  'fluid-ounce': { dimension: 'volume', factor: 0.0295735295625, offset: 0 },

  // ---- area, base hectare ---------------------------------------------------
  // Only two units, because `Intl` rejects `square-meter` and `square-foot`
  // outright — `acre` and `hectare` are the whole of its area vocabulary.
  // 1 acre ≡ 4046.8564224 m², so it is 0.40468564224 ha.
  hectare: { dimension: 'area', factor: 1, offset: 0 },
  acre: { dimension: 'area', factor: 0.40468564224, offset: 0 },

  // ---- digital, base byte ---------------------------------------------------
  // Decimal prefixes, because that is what these identifiers mean: `Intl` has
  // no binary prefixes at all and rejects `kibibyte`, so there is no honest way
  // to offer 1024-based units here.
  bit: { dimension: 'digital', factor: 0.125, offset: 0 },
  byte: { dimension: 'digital', factor: 1, offset: 0 },
  kilobit: { dimension: 'digital', factor: 125, offset: 0 },
  kilobyte: { dimension: 'digital', factor: 1000, offset: 0 },
  megabit: { dimension: 'digital', factor: 125_000, offset: 0 },
  megabyte: { dimension: 'digital', factor: 1e6, offset: 0 },
  gigabit: { dimension: 'digital', factor: 1.25e8, offset: 0 },
  gigabyte: { dimension: 'digital', factor: 1e9, offset: 0 },
  terabit: { dimension: 'digital', factor: 1.25e11, offset: 0 },
  terabyte: { dimension: 'digital', factor: 1e12, offset: 0 },
  petabyte: { dimension: 'digital', factor: 1e15, offset: 0 },

  // ---- temperature, base degree Celsius -------------------------------------
  // The whole reason `offset` exists. Fahrenheit's zero sits 32 °F below
  // Celsius's and its degree is 5/9 the size, so `(°F − 32) × 5/9` is the
  // conversion and no multiplier alone can express it.
  celsius: { dimension: 'temperature', factor: 1, offset: 0 },
  fahrenheit: { dimension: 'temperature', factor: 5 / 9, offset: 32 },
} as const satisfies Record<string, UnitDefinition>

/** Every unit identifier this field understands. All of them are `Intl` units. */
export type MeasurementUnit = keyof typeof UNITS

/** Every unit, largest first within each dimension. Useful for building pickers. */
export const MEASUREMENT_UNITS: readonly MeasurementUnit[] = /* @__PURE__ */ Object.keys(
  UNITS,
).sort((a, b) => {
  const left = UNITS[a as MeasurementUnit]
  const right = UNITS[b as MeasurementUnit]
  if (left.dimension !== right.dimension) return left.dimension < right.dimension ? -1 : 1
  return right.factor - left.factor
}) as MeasurementUnit[]

/** The base unit of each dimension — the one every conversion passes through. */
export const BASE_UNIT: Readonly<Record<Dimension, MeasurementUnit>> = {
  length: 'meter',
  mass: 'kilogram',
  volume: 'liter',
  area: 'hectare',
  digital: 'byte',
  temperature: 'celsius',
}

/**
 * `Intl` units this field deliberately refuses, and where they belong instead.
 *
 * Time units are the important entry. `Intl` sanctions `day`, `hour`, `minute`,
 * `second`, `week`, `month` and `year`, and a field that accepted them would be
 * a second, worse duration input owning the same value — so they are pointed at
 * the real one. `percent` and `degree` are refused for a different reason: they
 * have no conversion partner in `Intl`'s list, so a *converting* field has
 * nothing to do with them.
 */
export const REFUSED_UNITS: Readonly<Record<string, 'time' | 'no-partner'>> = {
  nanosecond: 'time',
  microsecond: 'time',
  millisecond: 'time',
  second: 'time',
  minute: 'time',
  hour: 'time',
  day: 'time',
  week: 'time',
  month: 'time',
  year: 'time',
  percent: 'no-partner',
  degree: 'no-partner',
}

/**
 * Significant digits kept on any computed number.
 *
 * Twelve, chosen from both ends: it is finer than any measurement a form
 * collects (a millimetre in the circumference of the Earth is ten digits), and
 * it is coarser than the binary error, which shows up around the sixteenth.
 */
const SIGNIFICANT = 12

/**
 * Drop binary floating-point noise from a computed result.
 *
 * The trade, stated rather than hidden: where a conversion lands on a repeating
 * decimal — seven feet is 2.333… yards — this throws away whatever the twelfth
 * digit could not carry, so converting there and back is accurate to a part in
 * 10⁹ rather than exact. Every pair a field may actually show has a whole-number
 * ratio and no repeating decimal to lose, so the round trip *is* exact there.
 */
export function tidy(value: number): number {
  if (!Number.isFinite(value) || value === 0) return value
  return Number(value.toPrecision(SIGNIFICANT))
}

/** Round to a number of decimal places, without the `toFixed` string leaking out. */
export function roundTo(value: number, places: number): number {
  if (!Number.isFinite(value)) return value
  return Number(value.toFixed(places))
}

/** Clamp a value into an inclusive range — what Home and End land on. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Whether a string is a unit this field can convert. */
export function isMeasurementUnit(value: unknown): value is MeasurementUnit {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(UNITS, value)
}

/** The family a unit belongs to, or `null` when it is not one we convert. */
export function dimensionOf(unit: string): Dimension | null {
  return isMeasurementUnit(unit) ? UNITS[unit].dimension : null
}

/** Whether a dimension can hold values below zero. Only temperature can. */
export function isSigned(dimension: Dimension): boolean {
  return dimension === 'temperature'
}

/** An amount expressed in its dimension's base unit. */
function toBase(amount: number, unit: MeasurementUnit): number {
  const { factor, offset } = UNITS[unit]
  return (amount - offset) * factor
}

/**
 * Convert between two units of the same dimension.
 *
 * `null` across dimensions rather than a number: asking how many kilograms a
 * metre is has no answer, and returning one would let the mistake travel.
 */
export function convert(amount: number, from: string, to: string): number | null {
  if (!isMeasurementUnit(from) || !isMeasurementUnit(to)) return null
  if (UNITS[from].dimension !== UNITS[to].dimension) return null
  if (!Number.isFinite(amount)) return null
  const target = UNITS[to]
  return tidy(toBase(amount, from) / target.factor + target.offset)
}

/**
 * How many of `smaller` fit in one `larger`, or `null` when that is not a
 * whole-number question.
 *
 * This is what decides whether two units can share a field. `5 ft 11 in` works
 * because a foot is exactly twelve inches — so the inches segment runs 0–11 and
 * a twelfth inch carries into the feet. There is no such rule for metres and
 * inches (39.37…), and a segment whose overflow point falls mid-unit is not a
 * segment. See {@link isCarryPair}.
 *
 * Offset units are excluded on principle: a ratio between two scales with
 * different zeroes is meaningless, and temperature is single-unit anyway.
 */
export function ratioBetween(larger: string, smaller: string): number | null {
  if (!isMeasurementUnit(larger) || !isMeasurementUnit(smaller)) return null
  const big = UNITS[larger]
  const small = UNITS[smaller]
  if (big.dimension !== small.dimension) return null
  if (big.offset !== 0 || small.offset !== 0) return null
  return tidy(big.factor / small.factor)
}

/** Order two units largest first. Only meaningful within one dimension. */
export function compareUnitSize(a: MeasurementUnit, b: MeasurementUnit): number {
  return UNITS[b].factor - UNITS[a].factor
}

/** Whether two units can sit side by side in one field, larger first. */
export function isCarryPair(larger: string, smaller: string): boolean {
  const ratio = ratioBetween(larger, smaller)
  return ratio !== null && Number.isInteger(ratio) && ratio > 1
}

// ---------------------------------------------------------------------------
// Parsing and formatting the canonical value
// ---------------------------------------------------------------------------

/** Why a `"<amount> <unit>"` string could not be read. */
export type MeasurementParseError = 'malformed' | 'unknown-unit' | 'time-unit' | 'no-partner'

/**
 * A failure, split so the unit half is only present where it exists.
 *
 * `'malformed'` means there was nothing recognisable to name; the other three
 * all read a real identifier and refused it, and the caller can say something
 * much more useful about `"90 minute"` than "unparseable".
 */
export type MeasurementParseFailure =
  | { ok: false; error: 'malformed' }
  | { ok: false; error: 'unknown-unit' | 'time-unit' | 'no-partner'; unit: string }

export interface MeasurementParseSuccess {
  ok: true
  amount: number
  unit: MeasurementUnit
}

export type MeasurementParseResult = MeasurementParseSuccess | MeasurementParseFailure

/**
 * A number and a unit, in that order.
 *
 * The separating space is optional (`71inch` parses) because a value that has
 * been through a URL query string or a spreadsheet often loses it, and the
 * grammar is unambiguous without it — no unit identifier starts with a digit.
 * A comma decimal is accepted for the same reason ISO 8601 accepts one.
 */
const MEASUREMENT = /^([+-]?\d+(?:[.,]\d+)?)\s*([a-z][a-z-]*)$/i

/** Read a `"<amount> <unit>"` string. */
export function parseMeasurement(value: unknown): MeasurementParseResult {
  // Typed loosely and checked, like the duration field's parser: this is a
  // public entry point reached from render, and the props feeding it come from
  // JSON payloads and form libraries where a bare number is the likeliest
  // mistake. `.trim()` on one would throw from inside a component.
  if (typeof value !== 'string') return { ok: false, error: 'malformed' }
  const match = MEASUREMENT.exec(value.trim())
  if (!match) return { ok: false, error: 'malformed' }

  const [, rawAmount, rawUnit] = match
  /* v8 ignore next */
  if (rawAmount === undefined || rawUnit === undefined) return { ok: false, error: 'malformed' }

  const unit = rawUnit.toLowerCase()
  const refused = REFUSED_UNITS[unit]
  if (refused !== undefined) {
    return { ok: false, error: refused === 'time' ? 'time-unit' : 'no-partner', unit }
  }
  if (!isMeasurementUnit(unit)) return { ok: false, error: 'unknown-unit', unit }

  const amount = Number(rawAmount.replace(',', '.'))
  if (!Number.isFinite(amount)) return { ok: false, error: 'malformed' }
  if (amount < 0 && !isSigned(UNITS[unit].dimension)) return { ok: false, error: 'malformed' }

  return { ok: true, amount, unit }
}

/**
 * The canonical spelling of an amount and a unit.
 *
 * `String(...)` rather than a fixed number of decimals: the value is data, not
 * display, and `"71 inch"` should not become `"71.00 inch"` because some other
 * field on the page needed two places.
 */
export function formatMeasurement(amount: number, unit: MeasurementUnit): string {
  return `${String(tidy(amount))} ${unit}`
}

/** An amount in its dimension's base unit, or `null` when the string is not one. */
export function toBaseUnit(value: string): number | null {
  const parsed = parseMeasurement(value)
  if (!parsed.ok) return null
  return convert(parsed.amount, parsed.unit, BASE_UNIT[UNITS[parsed.unit].dimension])
}

/**
 * Order two measurements.
 *
 * `null` — not `0` — when they are not comparable, because two different
 * dimensions are a category error rather than a tie. `compareMeasurements('1
 * meter', '1 kilogram')` has no answer, and sorting on a silent `0` would put
 * them in input order and look like it worked.
 */
export function compareMeasurements(a: string, b: string): number | null {
  const left = parseMeasurement(a)
  const right = parseMeasurement(b)
  if (!left.ok || !right.ok) return null
  if (UNITS[left.unit].dimension !== UNITS[right.unit].dimension) return null
  const inA = convert(right.amount, right.unit, left.unit)
  /* v8 ignore next */
  if (inA === null) return null
  return left.amount < inA ? -1 : left.amount > inA ? 1 : 0
}

/** Whether a measurement sits within an optional inclusive range. */
export function withinMeasurementRange(value: string, min?: string, max?: string): boolean {
  if (min !== undefined && (compareMeasurements(value, min) ?? 0) < 0) return false
  if (max !== undefined && (compareMeasurements(value, max) ?? 0) > 0) return false
  return true
}

// ---------------------------------------------------------------------------
// The segmented field
// ---------------------------------------------------------------------------

/** A partially-entered measurement. A missing or `null` unit is still empty. */
export type MeasurementParts = Readonly<Partial<Record<MeasurementUnit, number | null>>>

export const EMPTY_PARTS: MeasurementParts = {}

/** What is typed in one segment, treating "absent" and "empty" the same. */
export function partOf(parts: MeasurementParts, unit: MeasurementUnit): number | null {
  return parts[unit] ?? null
}

/** Every unit the field shows has been filled in. */
export function isComplete(parts: MeasurementParts, units: readonly MeasurementUnit[]): boolean {
  return units.length > 0 && units.every((unit) => partOf(parts, unit) !== null)
}

/** Whether any unit at all has been filled in. */
export function isEmpty(parts: MeasurementParts): boolean {
  // Typed wider than `Object.values` infers: a caller can hand us
  // `{ foot: undefined }` as easily as `{ foot: null }`, and both mean empty.
  return Object.values<number | null | undefined>(parts).every(
    (value) => value === null || value === undefined,
  )
}

/** Decimal places the smallest segment may carry. Coerced to 0–6. */
export function usablePrecision(precision: number): number {
  return Number.isInteger(precision) && precision >= 0 && precision <= 6 ? precision : 0
}

/** The smallest increment the smallest segment can hold at a given precision. */
export function quantum(precision: number): number {
  return roundTo(10 ** -precision, precision)
}

/**
 * Inclusive bounds for one segment.
 *
 * The leading unit is unbounded, exactly as in the duration field and for the
 * same reason: in a centimetres-only field `180` is a real height, and refusing
 * it would be refusing the most common thing anyone types. Every unit below the
 * leading one is bounded by its ratio to the unit above — 12 inches is not a
 * legal *inches component* once feet are on screen, because it means `1 ft 0 in`.
 *
 * Temperature is the one dimension with a floor below zero, so its leading
 * segment reports `-Infinity` rather than `0`. `Infinity` on either end rather
 * than a large number, so `aria-valuemin` / `aria-valuemax` can be omitted
 * instead of lying about a limit that does not exist.
 */
export function unitRange(
  unit: MeasurementUnit,
  units: readonly MeasurementUnit[],
  precision = 0,
): { min: number; max: number } {
  const index = units.indexOf(unit)
  const above = index > 0 ? units[index - 1] : undefined
  if (above === undefined) {
    const dimension = dimensionOf(unit)
    const min = dimension !== null && isSigned(dimension) ? -Infinity : 0
    return { min, max: Infinity }
  }
  const ratio = ratioBetween(above, unit)
  /* v8 ignore next */
  if (ratio === null) return { min: 0, max: Infinity }
  // The smallest segment is the only one that may carry decimals, so it is the
  // only one whose ceiling is a hair under the ratio rather than one below it:
  // at two places, inches under feet run to 11.99.
  const last = units[units.length - 1] === unit
  return { min: 0, max: roundTo(ratio - (last ? quantum(precision) : 1), precision) }
}

/**
 * Digits a segment shows before typing moves on to the next one.
 *
 * Bounded by *width*, never by the range. Bounding by the range makes the carry
 * — the whole point of a two-unit field — unreachable: with inches capped at 11,
 * a range-bounded segment refuses the `4` of `14` and `1 ft 2 in` can never be
 * typed. Width lets `14` be typed and blur settles it.
 *
 * Three digits only when the field has a single unit, where nothing follows to
 * advance to. With two units on screen the leading one takes two, because `5`
 * then `11` in a feet-and-inches field must not become 511 feet.
 */
export function unitWidth(
  unit: MeasurementUnit,
  units: readonly MeasurementUnit[],
  precision = 0,
): number {
  if (units[0] === unit) return units.length === 1 ? 3 : 2
  const { max } = unitRange(unit, units, precision)
  return String(Math.floor(max)).length
}

/**
 * What one segment paints when it holds a value.
 *
 * The leading segment is not zero-padded: it can be three digits wide, and
 * `090 cm` reads as a mistake. Every segment below it is padded to its own
 * width, so `1 m 5 cm` renders as `1 m 05 cm` and the field stops shifting
 * sideways as digits change.
 */
export function formatSegment(
  value: number,
  unit: MeasurementUnit,
  units: readonly MeasurementUnit[],
  precision = 0,
): string {
  const decimals = units[units.length - 1] === unit ? precision : 0
  const fixed = value.toFixed(decimals)
  if (units[0] === unit) return fixed
  const [whole = '', fraction] = fixed.split('.')
  const sign = whole.startsWith('-') ? '-' : ''
  const padded =
    sign + (sign === '' ? whole : whole.slice(1)).padStart(unitWidth(unit, units, precision), '0')
  return fraction === undefined ? padded : `${padded}.${fraction}`
}

/** What one segment paints when it is empty: one dash per digit it can hold. */
export function defaultPlaceholder(
  unit: MeasurementUnit,
  units: readonly MeasurementUnit[],
  precision = 0,
): string {
  const dashes = '-'.repeat(unitWidth(unit, units, precision))
  const decimals = units[units.length - 1] === unit ? precision : 0
  return decimals === 0 ? dashes : `${dashes}.${'-'.repeat(decimals)}`
}

/**
 * Carry overflow from smaller segments into larger ones.
 *
 * Typing `14` into the inches of a feet-and-inches field is legitimate — the
 * range bounds what a *component* may be, not what may be typed on the way
 * there. Settling on blur turns it into `1 ft 2 in`, which is the same length
 * written the way the field is shaped.
 */
export function normalise(
  parts: MeasurementParts,
  units: readonly MeasurementUnit[],
  precision = 0,
): MeasurementParts {
  if (isEmpty(parts) || units.length < 2) return parts

  const next: Partial<Record<MeasurementUnit, number | null>> = { ...parts }
  // Smallest first, carrying upward into the next unit on screen.
  for (let index = units.length - 1; index > 0; index--) {
    const unit = units[index]
    const above = units[index - 1]
    /* v8 ignore next */
    if (unit === undefined || above === undefined) continue
    const value = next[unit] ?? null
    if (value === null) continue
    const ratio = ratioBetween(above, unit)
    /* v8 ignore next */
    if (ratio === null) continue
    const carry = Math.floor(value / ratio)
    if (carry === 0) continue
    next[unit] = roundTo(value - carry * ratio, precision)
    next[above] = (next[above] ?? 0) + carry
  }
  return next
}

/** The total a set of parts comes to, counted in the smallest unit on screen. */
export function partsToAmount(
  parts: MeasurementParts,
  units: readonly MeasurementUnit[],
  precision = 0,
): number | null {
  const smallest = units[units.length - 1]
  if (smallest === undefined) return null
  let total = 0
  for (const unit of units) {
    const value = partOf(parts, unit)
    if (value === null || !Number.isFinite(value)) return null
    const ratio = unit === smallest ? 1 : ratioBetween(unit, smallest)
    /* v8 ignore next */
    if (ratio === null) return null
    total += value * ratio
  }
  return roundTo(total, precision)
}

/**
 * The canonical value for a complete set of parts, or `null` when incomplete.
 *
 * Emitted in the **smallest unit on screen**, not converted to a base unit —
 * and that is a deliberate difference from the duration field, which does
 * normalise. Duration can, because its base is integral seconds. Measurement
 * cannot: one foot in metres is `0.30479999999999996` in binary floating point,
 * so normalising would write float noise into the canonical value. `"12 inch"`
 * is exact and lossless; `"0.3048 meter"` only looks it.
 *
 * The consequence is real and is documented rather than hidden: two equal
 * measurements are not `===` equal. {@link compareMeasurements} is the
 * comparison.
 */
export function toMeasurement(
  parts: MeasurementParts,
  units: readonly MeasurementUnit[],
  precision = 0,
): string | null {
  if (!isComplete(parts, units)) return null
  const smallest = units[units.length - 1]
  /* v8 ignore next */
  if (smallest === undefined) return null
  const amount = partsToAmount(parts, units, precision)
  if (amount === null) return null
  const dimension = dimensionOf(smallest)
  if (amount < 0 && (dimension === null || !isSigned(dimension))) return null
  return formatMeasurement(amount, smallest)
}

/** Split an amount of the smallest unit across the segments the field shows. */
export function splitAmount(
  amount: number,
  units: readonly MeasurementUnit[],
  precision = 0,
): MeasurementParts {
  const parts: Partial<Record<MeasurementUnit, number | null>> = {}
  const smallest = units[units.length - 1]
  /* v8 ignore next */
  if (smallest === undefined) return parts
  let rest = roundTo(amount, precision)
  for (let index = 0; index < units.length - 1; index++) {
    const unit = units[index]
    /* v8 ignore next */
    if (unit === undefined) continue
    const ratio = ratioBetween(unit, smallest)
    /* v8 ignore next */
    if (ratio === null) continue
    const whole = Math.floor(rest / ratio)
    parts[unit] = whole
    rest = roundTo(rest - whole * ratio, precision)
  }
  parts[smallest] = rest
  return parts
}

/**
 * Read a `"<amount> <unit>"` string into the segments a field shows.
 *
 * `null` when the string is unreadable **or belongs to another dimension** — a
 * mass arriving in a length field is not something to coerce, and rendering it
 * as a number of centimetres would be inventing data.
 */
export function fromMeasurement(
  value: string,
  units: readonly MeasurementUnit[],
  precision = 0,
): MeasurementParts | null {
  const parsed = parseMeasurement(value)
  if (!parsed.ok) return null
  const smallest = units[units.length - 1]
  if (smallest === undefined) return null
  const amount = convert(parsed.amount, parsed.unit, smallest)
  if (amount === null) return null
  return splitAmount(amount, units, precision)
}

/**
 * Whether a value survives being shown in `units` at `precision` without loss.
 *
 * `"1.8034 meter"` in a feet-and-inches field at zero decimals is 71 inches and
 * nothing lost; `"1.81 meter"` is 71.26 inches and rounds to 71. The field shows
 * the rounded value either way — refusing it outright would be worse — but the
 * loss is invisible from the outside, and a form that round-trips it writes back
 * a different measurement than it read.
 */
export function fitsUnits(
  value: string,
  units: readonly MeasurementUnit[],
  precision = 0,
): boolean {
  const parsed = parseMeasurement(value)
  if (!parsed.ok) return true
  const smallest = units[units.length - 1]
  if (smallest === undefined) return true
  const amount = convert(parsed.amount, parsed.unit, smallest)
  if (amount === null) return true
  return roundTo(amount, precision) === amount
}
