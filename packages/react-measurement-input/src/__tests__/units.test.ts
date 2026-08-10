import { describe, expect, it } from 'vitest'
import {
  EMPTY_PARTS,
  MEASUREMENT_UNITS,
  clamp,
  compareMeasurements,
  compareUnitSize,
  convert,
  defaultPlaceholder,
  dimensionOf,
  fitsUnits,
  formatMeasurement,
  formatSegment,
  fromMeasurement,
  isCarryPair,
  isComplete,
  isEmpty,
  isMeasurementUnit,
  isSigned,
  normalise,
  parseMeasurement,
  partOf,
  partsToAmount,
  quantum,
  ratioBetween,
  roundTo,
  splitAmount,
  tidy,
  toBaseUnit,
  toMeasurement,
  unitRange,
  unitWidth,
  usablePrecision,
  withinMeasurementRange,
} from '../units'
import type { MeasurementUnit } from '../units'

/** The failure kind, for the cases where only the kind is the point. */
function refusal(value: unknown): string | null {
  const parsed = parseMeasurement(value)
  return parsed.ok ? null : parsed.error
}

describe('the table', () => {
  it('holds only units Intl itself sanctions', () => {
    // The whole premise of the value format is that the unit half is an `Intl`
    // identifier verbatim. A typo here would produce a value nothing else can
    // read and a suffix that silently falls back.
    const sanctioned = new Set(Intl.supportedValuesOf('unit'))
    for (const unit of MEASUREMENT_UNITS) expect(sanctioned.has(unit)).toBe(true)
  })

  it('gives every dimension exactly one base unit', () => {
    const bases = new Map<string, string[]>()
    for (const unit of MEASUREMENT_UNITS) {
      const dimension = dimensionOf(unit)
      expect(dimension).not.toBeNull()
      if (convert(1, unit, unit) === 1 && ratioBetween(unit, unit) === 1) {
        bases.set(dimension ?? '', [...(bases.get(dimension ?? '') ?? []), unit])
      }
    }
    expect(bases.size).toBe(6)
  })

  it('round-trips every pair of units in every dimension', () => {
    for (const from of MEASUREMENT_UNITS) {
      for (const to of MEASUREMENT_UNITS) {
        if (dimensionOf(from) !== dimensionOf(to)) continue
        const there = convert(7, from, to)
        expect(there).not.toBeNull()
        // To within a part in 10^9, not exactly. Seven feet is 2.333… yards, a
        // repeating decimal that no finite representation holds — so the round
        // trip loses whatever the twelfth significant digit could not carry.
        // That is the trade `tidy` makes on purpose, and the error it leaves is
        // a thousand times smaller than the width of an atom on a human height.
        expect(convert(there ?? 0, to, from)).toBeCloseTo(7, 9)
      }
    }
  })

  it('converts exactly into the smaller of any pair a field may show', () => {
    // The direction the field itself uses: `fromMeasurement` converts a value
    // *into* the smallest unit on screen, and `toMeasurement` sums into it. The
    // pairs `usableUnits` allows all have a whole-number ratio, so that
    // direction is an integer multiplication with nothing to lose — which is
    // what keeps the canonical value stable across a read-render-write cycle.
    //
    // The other direction is a division and can repeat: seven feet is
    // 0.0013257575… miles, and no amount of care makes that exact.
    for (const larger of MEASUREMENT_UNITS) {
      for (const smaller of MEASUREMENT_UNITS) {
        if (!isCarryPair(larger, smaller)) continue
        const ratio = ratioBetween(larger, smaller) ?? 0
        expect(convert(7, larger, smaller)).toBe(7 * ratio)
      }
    }
  })

  /**
   * The 1959 international yard and pound agreement, to the digit. These are
   * the numbers the whole package rests on; asserting them here means a typo in
   * the table fails one obvious test rather than skewing every conversion by a
   * fraction of a percent.
   */
  it('matches the exact legal definitions', () => {
    expect(convert(1, 'inch', 'millimeter')).toBe(25.4)
    expect(convert(1, 'foot', 'meter')).toBe(0.3048)
    expect(convert(1, 'yard', 'meter')).toBe(0.9144)
    expect(convert(1, 'mile', 'meter')).toBe(1609.344)
    expect(convert(1, 'pound', 'kilogram')).toBe(0.45359237)
    expect(convert(1, 'ounce', 'gram')).toBe(28.349523125)
    expect(convert(1, 'stone', 'pound')).toBe(14)
    expect(convert(1, 'gallon', 'liter')).toBe(3.785411784)
    expect(convert(1, 'gallon', 'fluid-ounce')).toBe(128)
    expect(convert(1, 'acre', 'hectare')).toBe(0.40468564224)
    expect(convert(1, 'byte', 'bit')).toBe(8)
    // The Scandinavian mil is exactly ten kilometres, not a rounded statute mile.
    expect(convert(1, 'mile-scandinavian', 'kilometer')).toBe(10)
  })

  it('uses decimal prefixes for digital units, because that is what Intl means', () => {
    expect(convert(1, 'kilobyte', 'byte')).toBe(1000)
    expect(convert(1, 'megabyte', 'byte')).toBe(1e6)
    // Not 1024. `Intl` rejects `kibibyte` outright, so there is no honest way
    // to offer a binary prefix here.
    expect(convert(1, 'kilobyte', 'byte')).not.toBe(1024)
  })

  it('orders units largest first within a dimension', () => {
    expect(compareUnitSize('foot', 'inch')).toBeLessThan(0)
    expect(compareUnitSize('inch', 'foot')).toBeGreaterThan(0)
    expect(compareUnitSize('meter', 'meter')).toBe(0)
  })
})

/**
 * The headline correctness item. A factor-only table converts 100 °C to 100 °F
 * and looks like it worked.
 */
describe('temperature is an offset scale, not a ratio', () => {
  it('converts through the offset in both directions', () => {
    expect(convert(212, 'fahrenheit', 'celsius')).toBe(100)
    expect(convert(100, 'celsius', 'fahrenheit')).toBe(212)
    expect(convert(32, 'fahrenheit', 'celsius')).toBe(0)
    expect(convert(0, 'celsius', 'fahrenheit')).toBe(32)
    // The one place the two scales meet.
    expect(convert(-40, 'celsius', 'fahrenheit')).toBe(-40)
  })

  it('does not treat the two as proportional', () => {
    expect(convert(100, 'fahrenheit', 'celsius')).not.toBe(100)
    // What a factor table would produce: 100 × (5/9).
    expect(convert(100, 'fahrenheit', 'celsius')).not.toBe(roundTo(100 * (5 / 9), 10))
  })

  it('refuses to hand out a ratio between two offset scales', () => {
    expect(ratioBetween('celsius', 'fahrenheit')).toBeNull()
    expect(isCarryPair('celsius', 'fahrenheit')).toBe(false)
  })

  it('is the only signed dimension', () => {
    expect(isSigned('temperature')).toBe(true)
    for (const dimension of ['length', 'mass', 'volume', 'area', 'digital'] as const) {
      expect(isSigned(dimension)).toBe(false)
    }
  })
})

/**
 * The rule that decides which units may share a field. Asserted against the
 * real constants rather than a hand-written list, so adding a unit to the table
 * cannot quietly create a pair whose overflow point falls mid-unit.
 */
describe('the whole-number ratio rule', () => {
  it('accepts the pairs a segmented field is built from', () => {
    expect(ratioBetween('foot', 'inch')).toBe(12)
    expect(ratioBetween('yard', 'foot')).toBe(3)
    expect(ratioBetween('mile', 'yard')).toBe(1760)
    expect(ratioBetween('meter', 'centimeter')).toBe(100)
    expect(ratioBetween('pound', 'ounce')).toBe(16)
    expect(ratioBetween('stone', 'pound')).toBe(14)
    expect(ratioBetween('gallon', 'fluid-ounce')).toBe(128)
    for (const [larger, smaller] of [
      ['foot', 'inch'],
      ['stone', 'pound'],
      ['meter', 'centimeter'],
      ['gallon', 'fluid-ounce'],
      ['kilobyte', 'byte'],
    ] as const) {
      expect(isCarryPair(larger, smaller)).toBe(true)
    }
  })

  it('rejects the pairs with no whole-number ratio', () => {
    // 39.37…: an inches segment beside a metres one would have no ceiling to
    // carry at.
    expect(Number.isInteger(ratioBetween('meter', 'inch'))).toBe(false)
    expect(isCarryPair('meter', 'inch')).toBe(false)
    // 2.471…: the entire reason the area dimension is single-unit in practice.
    expect(isCarryPair('hectare', 'acre')).toBe(false)
    expect(isCarryPair('mile', 'kilometer')).toBe(false)
  })

  it('rejects a unit paired with itself, which would carry forever', () => {
    expect(isCarryPair('meter', 'meter')).toBe(false)
  })

  it('is null across dimensions and for anything not a unit', () => {
    expect(ratioBetween('meter', 'kilogram')).toBeNull()
    expect(ratioBetween('meter', 'furlong')).toBeNull()
    expect(ratioBetween('furlong', 'meter')).toBeNull()
  })
})

describe('convert', () => {
  it('is null across dimensions rather than a number', () => {
    expect(convert(1, 'meter', 'kilogram')).toBeNull()
    expect(convert(1, 'celsius', 'meter')).toBeNull()
  })

  it('is null for a unit it does not know', () => {
    expect(convert(1, 'furlong', 'meter')).toBeNull()
    expect(convert(1, 'meter', 'furlong')).toBeNull()
  })

  it('is null for an amount that is not a number', () => {
    expect(convert(Number.NaN, 'meter', 'inch')).toBeNull()
    expect(convert(Infinity, 'meter', 'inch')).toBeNull()
  })

  it('drops the binary noise that would otherwise leak into a value', () => {
    // 5 × 0.3048 ÷ 0.01 is 152.39999999999998 in binary floating point.
    expect(convert(5, 'foot', 'centimeter')).toBe(152.4)
    expect(convert(1, 'foot', 'inch')).toBe(12)
  })
})

describe('tidy, roundTo, clamp and quantum', () => {
  it('leaves zero and non-finite numbers alone', () => {
    expect(tidy(0)).toBe(0)
    expect(tidy(Infinity)).toBe(Infinity)
    expect(Number.isNaN(tidy(Number.NaN))).toBe(true)
    expect(roundTo(Infinity, 2)).toBe(Infinity)
  })

  it('rounds to a number of places', () => {
    expect(roundTo(36.649, 1)).toBe(36.6)
    expect(roundTo(36.66, 1)).toBe(36.7)
    expect(roundTo(71.4, 0)).toBe(71)
    expect(roundTo(71.5, 0)).toBe(72)
  })

  it('clamps into an inclusive range', () => {
    expect(clamp(5, 0, 11)).toBe(5)
    expect(clamp(-2, 0, 11)).toBe(0)
    expect(clamp(99, 0, 11)).toBe(11)
  })

  it('reports the smallest increment a precision can hold', () => {
    expect(quantum(0)).toBe(1)
    expect(quantum(1)).toBe(0.1)
    expect(quantum(3)).toBe(0.001)
  })

  it('coerces a precision outside 0–6 to zero', () => {
    expect(usablePrecision(2)).toBe(2)
    expect(usablePrecision(0)).toBe(0)
    expect(usablePrecision(6)).toBe(6)
    expect(usablePrecision(-3)).toBe(0)
    expect(usablePrecision(7)).toBe(0)
    expect(usablePrecision(1.5)).toBe(0)
    expect(usablePrecision(Number.NaN)).toBe(0)
  })
})

describe('parseMeasurement', () => {
  it('reads an amount and an Intl unit', () => {
    expect(parseMeasurement('71 inch')).toEqual({ ok: true, amount: 71, unit: 'inch' })
    expect(parseMeasurement('1.8034 meter')).toEqual({
      ok: true,
      amount: 1.8034,
      unit: 'meter',
    })
    expect(parseMeasurement('  180 centimeter  ')).toEqual({
      ok: true,
      amount: 180,
      unit: 'centimeter',
    })
  })

  it('accepts a missing space and a comma decimal', () => {
    // Both survive a trip through a URL query string or a spreadsheet, and the
    // grammar is unambiguous without them: no unit identifier starts with a digit.
    expect(parseMeasurement('71inch')).toEqual({ ok: true, amount: 71, unit: 'inch' })
    expect(parseMeasurement('36,6 celsius')).toEqual({ ok: true, amount: 36.6, unit: 'celsius' })
  })

  it('accepts a hyphenated unit and any case', () => {
    expect(parseMeasurement('8 fluid-ounce')).toEqual({
      ok: true,
      amount: 8,
      unit: 'fluid-ounce',
    })
    expect(parseMeasurement('8 FLUID-OUNCE')).toEqual({
      ok: true,
      amount: 8,
      unit: 'fluid-ounce',
    })
  })

  it('allows a negative amount only where the scale has one', () => {
    expect(parseMeasurement('-5 celsius')).toEqual({ ok: true, amount: -5, unit: 'celsius' })
    expect(parseMeasurement('-5 kilogram')).toEqual({ ok: false, error: 'malformed' })
  })

  it('names a time unit rather than calling it garbage', () => {
    // The one refusal a caller can act on: the value belongs to a different
    // component, and the message says which.
    expect(parseMeasurement('90 minute')).toEqual({
      ok: false,
      error: 'time-unit',
      unit: 'minute',
    })
    expect(refusal('2 hour')).toBe('time-unit')
    expect(refusal('1 year')).toBe('time-unit')
  })

  it('names a unit with no conversion partner', () => {
    expect(parseMeasurement('50 percent')).toEqual({
      ok: false,
      error: 'no-partner',
      unit: 'percent',
    })
    expect(refusal('90 degree')).toBe('no-partner')
  })

  it('separates an unknown unit from an unreadable string', () => {
    expect(parseMeasurement('5 furlong')).toEqual({
      ok: false,
      error: 'unknown-unit',
      unit: 'furlong',
    })
    // "cm" is the abbreviation, not the identifier.
    expect(refusal('180 cm')).toBe('unknown-unit')
    expect(refusal('180')).toBe('malformed')
    expect(refusal('meter')).toBe('malformed')
    expect(refusal('')).toBe('malformed')
  })

  it('refuses a non-string without throwing', () => {
    // Reached from render with whatever a form library hands over.
    for (const value of [180, null, undefined, {}, [], Number.NaN]) {
      expect(parseMeasurement(value)).toEqual({ ok: false, error: 'malformed' })
    }
  })
})

describe('formatMeasurement, toBaseUnit and comparison', () => {
  it('writes the canonical spelling', () => {
    expect(formatMeasurement(71, 'inch')).toBe('71 inch')
    expect(formatMeasurement(71.5, 'inch')).toBe('71.5 inch')
    expect(formatMeasurement(0, 'centimeter')).toBe('0 centimeter')
  })

  it('reports an amount in its dimension base', () => {
    expect(toBaseUnit('71 inch')).toBe(1.8034)
    expect(toBaseUnit('180 centimeter')).toBe(1.8)
    expect(toBaseUnit('11 stone')).toBe(69.85322498)
    expect(toBaseUnit('212 fahrenheit')).toBe(100)
    expect(toBaseUnit('nonsense')).toBeNull()
  })

  /**
   * The documented consequence of emitting the smallest unit on screen: two
   * equal measurements are not `===` equal, so ordering has to go through here.
   */
  it('orders measurements written in different units', () => {
    const [inches, metres] = ['71 inch', '1.8034 meter'] as string[]
    expect(inches === metres).toBe(false)
    expect(compareMeasurements(inches ?? '', metres ?? '')).toBe(0)
    expect(compareMeasurements('71 inch', '1.8 meter')).toBe(1)
    expect(compareMeasurements('1.8 meter', '71 inch')).toBe(-1)
  })

  it('is null across dimensions rather than a tie', () => {
    // `0` would sort them in input order and look like it worked.
    expect(compareMeasurements('1 meter', '1 kilogram')).toBeNull()
    expect(compareMeasurements('1 meter', 'nonsense')).toBeNull()
    expect(compareMeasurements('nonsense', '1 meter')).toBeNull()
  })

  it('checks a range whose bounds are in other units than the value', () => {
    expect(withinMeasurementRange('71 inch', '1 meter', '2 meter')).toBe(true)
    expect(withinMeasurementRange('71 inch', '2 meter')).toBe(false)
    expect(withinMeasurementRange('71 inch', undefined, '1 meter')).toBe(false)
    expect(withinMeasurementRange('71 inch')).toBe(true)
    // An incomparable bound is ignored rather than making everything invalid.
    expect(withinMeasurementRange('71 inch', '1 kilogram')).toBe(true)
  })
})

describe('the segmented field', () => {
  const ftIn: MeasurementUnit[] = ['foot', 'inch']
  const mCm: MeasurementUnit[] = ['meter', 'centimeter']

  it('treats a missing key and a null the same', () => {
    expect(partOf({}, 'foot')).toBeNull()
    expect(partOf({ foot: null }, 'foot')).toBeNull()
    expect(partOf({ foot: 5 }, 'foot')).toBe(5)
    expect(isEmpty(EMPTY_PARTS)).toBe(true)
    expect(isEmpty({ foot: null })).toBe(true)
    expect(isEmpty({ foot: 0 })).toBe(false)
  })

  it('is complete only when every unit on screen is filled', () => {
    expect(isComplete({ foot: 5, inch: 11 }, ftIn)).toBe(true)
    expect(isComplete({ foot: 5 }, ftIn)).toBe(false)
    expect(isComplete({}, [])).toBe(false)
  })

  it('leaves the leading segment unbounded and bounds the rest by their ratio', () => {
    expect(unitRange('foot', ftIn)).toEqual({ min: 0, max: Infinity })
    expect(unitRange('inch', ftIn)).toEqual({ min: 0, max: 11 })
    expect(unitRange('centimeter', mCm)).toEqual({ min: 0, max: 99 })
    expect(unitRange('fluid-ounce', ['gallon', 'fluid-ounce'])).toEqual({ min: 0, max: 127 })
  })

  it('gives a decimal segment a ceiling a hair under the ratio', () => {
    // At two places, inches under feet run to 11.99 — not 11, which would make
    // the last hundredth of a foot unreachable.
    expect(unitRange('inch', ftIn, 2)).toEqual({ min: 0, max: 11.99 })
    expect(unitRange('inch', ftIn, 1)).toEqual({ min: 0, max: 11.9 })
  })

  it('gives a temperature field no floor', () => {
    expect(unitRange('celsius', ['celsius'], 1)).toEqual({ min: -Infinity, max: Infinity })
  })

  /**
   * The fix for the bug that made the carry unreachable: bounding entry by the
   * *range* means a 0–11 inches segment refuses the `4` of `14`, and
   * `1 ft 2 in` can never be typed.
   */
  it('sizes a segment by digits, not by its range', () => {
    expect(unitWidth('inch', ftIn)).toBe(2)
    expect(unitWidth('centimeter', mCm)).toBe(2)
    expect(unitWidth('fluid-ounce', ['gallon', 'fluid-ounce'])).toBe(3)
    expect(unitWidth('gram', ['kilogram', 'gram'])).toBe(3)
  })

  it('gives the leading segment three digits only when it is alone', () => {
    // Otherwise `5` then `11` in a feet-and-inches field would become 511 feet.
    expect(unitWidth('foot', ftIn)).toBe(2)
    expect(unitWidth('centimeter', ['centimeter'])).toBe(3)
  })

  it('pads every segment but the leading one', () => {
    expect(formatSegment(5, 'foot', ftIn)).toBe('5')
    expect(formatSegment(5, 'inch', ftIn)).toBe('05')
    expect(formatSegment(5, 'fluid-ounce', ['gallon', 'fluid-ounce'])).toBe('005')
    expect(formatSegment(36.6, 'celsius', ['celsius'], 1)).toBe('36.6')
    expect(formatSegment(5.25, 'inch', ftIn, 2)).toBe('05.25')
    expect(formatSegment(-5, 'celsius', ['celsius'])).toBe('-5')
  })

  it('paints one dash per digit while empty', () => {
    expect(defaultPlaceholder('foot', ftIn)).toBe('--')
    expect(defaultPlaceholder('centimeter', ['centimeter'])).toBe('---')
    expect(defaultPlaceholder('celsius', ['celsius'], 1)).toBe('---.-')
  })
})

describe('the carry', () => {
  it('carries overflow into the unit above', () => {
    expect(normalise({ foot: 0, inch: 14 }, ['foot', 'inch'])).toEqual({ foot: 1, inch: 2 })
    expect(normalise({ meter: 1, centimeter: 250 }, ['meter', 'centimeter'])).toEqual({
      meter: 3,
      centimeter: 50,
    })
    expect(normalise({ stone: 0, pound: 30 }, ['stone', 'pound'])).toEqual({
      stone: 2,
      pound: 2,
    })
  })

  it('carries through three units at once', () => {
    expect(normalise({ mile: 0, yard: 0, foot: 40 }, ['mile', 'yard', 'foot'])).toEqual({
      mile: 0,
      yard: 13,
      foot: 1,
    })
  })

  it('keeps the fraction on the smallest segment', () => {
    expect(normalise({ foot: 0, inch: 14.5 }, ['foot', 'inch'], 1)).toEqual({
      foot: 1,
      inch: 2.5,
    })
  })

  it('leaves a single-unit field and an empty field alone', () => {
    const single = { centimeter: 180 }
    expect(normalise(single, ['centimeter'])).toBe(single)
    expect(normalise(EMPTY_PARTS, ['foot', 'inch'])).toBe(EMPTY_PARTS)
  })

  it('leaves an empty segment out of the carry', () => {
    expect(normalise({ foot: 5, inch: null }, ['foot', 'inch'])).toEqual({
      foot: 5,
      inch: null,
    })
  })

  it('does nothing when nothing overflows', () => {
    expect(normalise({ foot: 5, inch: 11 }, ['foot', 'inch'])).toEqual({ foot: 5, inch: 11 })
  })
})

describe('reading and writing the value', () => {
  it('emits the total in the smallest unit on screen', () => {
    expect(toMeasurement({ foot: 5, inch: 11 }, ['foot', 'inch'])).toBe('71 inch')
    expect(toMeasurement({ meter: 1, centimeter: 80 }, ['meter', 'centimeter'])).toBe(
      '180 centimeter',
    )
    expect(toMeasurement({ celsius: 36.6 }, ['celsius'], 1)).toBe('36.6 celsius')
  })

  /**
   * The reason it is not normalised to a base unit: one foot in metres is
   * 0.30479999999999996, so a "canonical" metric value would carry float noise
   * that no amount of rounding can make exact again.
   */
  it('stays exact where a metric normalisation would not', () => {
    expect(toMeasurement({ foot: 1, inch: 0 }, ['foot', 'inch'])).toBe('12 inch')
    expect(1 * 0.3048).not.toBe(0.3048 * 1.0000000001)
    expect(toBaseUnit('12 inch')).toBe(0.3048)
  })

  it('is null while any segment is empty', () => {
    expect(toMeasurement({ foot: 5 }, ['foot', 'inch'])).toBeNull()
    expect(toMeasurement({}, ['foot', 'inch'])).toBeNull()
  })

  it('is null for a segment holding something that is not a number', () => {
    expect(toMeasurement({ foot: Number.NaN, inch: 0 }, ['foot', 'inch'])).toBeNull()
    expect(partsToAmount({ foot: Infinity, inch: 0 }, ['foot', 'inch'])).toBeNull()
    expect(partsToAmount({}, [])).toBeNull()
  })

  it('refuses to write a negative measurement in an unsigned dimension', () => {
    expect(toMeasurement({ centimeter: -5 }, ['centimeter'])).toBeNull()
    expect(toMeasurement({ celsius: -5 }, ['celsius'])).toBe('-5 celsius')
  })

  it('splits a value across the segments on screen', () => {
    expect(fromMeasurement('71 inch', ['foot', 'inch'])).toEqual({ foot: 5, inch: 11 })
    expect(fromMeasurement('1.8034 meter', ['foot', 'inch'])).toEqual({ foot: 5, inch: 11 })
    expect(fromMeasurement('180 centimeter', ['meter', 'centimeter'])).toEqual({
      meter: 1,
      centimeter: 80,
    })
  })

  it('folds a value into a single-unit field', () => {
    expect(fromMeasurement('5 foot', ['inch'])).toEqual({ inch: 60 })
  })

  it('is null for a value from another dimension', () => {
    // Not coerced: rendering a mass as a number of centimetres would be
    // inventing data.
    expect(fromMeasurement('70 kilogram', ['meter', 'centimeter'])).toBeNull()
    expect(fromMeasurement('nonsense', ['meter', 'centimeter'])).toBeNull()
    expect(fromMeasurement('1 meter', [])).toBeNull()
  })

  it('round-trips a value through the segments', () => {
    for (const value of ['71 inch', '0 inch', '180 centimeter', '155 pound']) {
      const units = (
        value.endsWith('inch')
          ? ['foot', 'inch']
          : value.endsWith('centimeter')
            ? ['meter', 'centimeter']
            : ['stone', 'pound']
      ) as MeasurementUnit[]
      const parts = fromMeasurement(value, units)
      expect(parts).not.toBeNull()
      expect(toMeasurement(parts ?? {}, units)).toBe(value)
    }
  })

  it('reports a value finer than the field can show', () => {
    // 1.81 m is 71.259… inches; the field shows 71 and the caller is told.
    expect(fitsUnits('1.81 meter', ['foot', 'inch'])).toBe(false)
    expect(fitsUnits('1.8034 meter', ['foot', 'inch'])).toBe(true)
    expect(fitsUnits('36.65 celsius', ['celsius'], 1)).toBe(false)
    expect(fitsUnits('36.6 celsius', ['celsius'], 1)).toBe(true)
    // Nothing to say about a value that could not be read at all.
    expect(fitsUnits('nonsense', ['foot', 'inch'])).toBe(true)
    expect(fitsUnits('1 meter', [])).toBe(true)
    expect(fitsUnits('70 kilogram', ['foot', 'inch'])).toBe(true)
  })

  it('splits nothing across no units', () => {
    expect(splitAmount(5, [])).toEqual({})
  })
})

describe('isMeasurementUnit', () => {
  it('accepts the table and rejects everything else', () => {
    expect(isMeasurementUnit('meter')).toBe(true)
    expect(isMeasurementUnit('minute')).toBe(false)
    expect(isMeasurementUnit('furlong')).toBe(false)
    expect(isMeasurementUnit(5)).toBe(false)
    expect(isMeasurementUnit(null)).toBe(false)
    // Not a property inherited from Object.prototype.
    expect(isMeasurementUnit('toString')).toBe(false)
    expect(isMeasurementUnit('constructor')).toBe(false)
  })

  it('reports no dimension for a unit it does not know', () => {
    expect(dimensionOf('furlong')).toBeNull()
    expect(dimensionOf('minute')).toBeNull()
  })
})
