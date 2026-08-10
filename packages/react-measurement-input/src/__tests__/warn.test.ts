import { describe, expect, it } from 'vitest'
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
} from '../warn'
import type { MeasurementUnit } from '../units'

const FT_IN: MeasurementUnit[] = ['foot', 'inch']

describe('inspectValue', () => {
  it('says nothing about a value the field can hold', () => {
    expect(inspectValue('71 inch', 'value', FT_IN)).toBeNull()
    expect(inspectValue('1.8 meter', 'value', FT_IN)).toBeNull()
    expect(inspectValue('71 inch', 'value', [])).toBeNull()
  })

  it('names a bare number as the ambiguity this field exists to remove', () => {
    const warning = inspectValue('180', 'value', FT_IN)
    expect(warning?.code).toBe('value-unparseable')
    // The suggestion is in the field's own smallest unit, so it is copy-pasteable.
    expect(warning?.message).toContain('180 inch')
  })

  it('points a time unit at the duration input by name', () => {
    const warning = inspectValue('90 minute', 'value', FT_IN)
    expect(warning?.code).toBe('value-time-unit')
    expect(warning?.message).toContain('@rxova/react-duration-input')
  })

  it('explains a unit with no conversion partner', () => {
    expect(inspectValue('50 percent', 'value', FT_IN)?.code).toBe('value-no-partner')
  })

  it('separates an abbreviation from an unknown unit', () => {
    const warning = inspectValue('180 cm', 'value', FT_IN)
    expect(warning?.code).toBe('value-unknown-unit')
    expect(warning?.message).toContain('"centimeter", not "cm"')
  })

  it('refuses a value from another dimension without coercing it', () => {
    const warning = inspectValue('70 kilogram', 'value', FT_IN)
    expect(warning?.code).toBe('value-dimension-mismatch')
    expect(warning?.message).toContain('mass')
    expect(warning?.message).toContain('length')
  })

  it('describes a non-string without throwing on it', () => {
    for (const value of [180, null, {}, [], undefined]) {
      expect(() => inspectValue(value, 'value', FT_IN)).not.toThrow()
    }
    expect(inspectValue({ amount: 5 }, 'value', FT_IN)?.code).toBe('value-unparseable')
    // `JSON.stringify(undefined)` is `undefined`, so the message has to fall
    // back to `String` to have anything to quote at all.
    expect(inspectValue(undefined, 'value', FT_IN)?.received).toBe('undefined')
  })

  it('quotes a circular object rather than throwing while explaining it', () => {
    // `JSON.stringify` throws on this. A diagnostic that blows up while
    // describing a bad prop is the worst of both.
    const circular: Record<string, unknown> = {}
    circular.self = circular
    expect(inspectValue(circular, 'value', FT_IN)?.received).toBe('[object Object]')
  })

  it('falls back to the generic hint when there is no unit to suggest', () => {
    // No units on screen means no unit to put in the suggestion.
    const warning = inspectValue('180', 'value', [])
    expect(warning?.code).toBe('value-unparseable')
    expect(warning?.message).toContain('71 inch')
  })

  it('carries the prop name it was given', () => {
    expect(inspectValue('nope', 'defaultValue', FT_IN)?.prop).toBe('defaultValue')
  })
})

describe('inspectTruncation', () => {
  it('reports a value finer than the field can show', () => {
    const warning = inspectTruncation('1.81 meter', FT_IN, 0, 'value')
    expect(warning?.code).toBe('value-truncated')
    expect(warning?.message).toContain('whole inchs')
  })

  it('says nothing when the value survives exactly', () => {
    expect(inspectTruncation('1.8034 meter', FT_IN, 0, 'value')).toBeNull()
    expect(inspectTruncation('nonsense', FT_IN, 0, 'value')).toBeNull()
  })

  it('describes the loss in decimal places when there are any', () => {
    const warning = inspectTruncation('36.65 celsius', ['celsius'], 1, 'value')
    expect(warning?.message).toContain('1 decimal place')
    expect(inspectTruncation('1.81 meter', [], 0, 'value')).toBeNull()
  })
})

describe('inspectBound and inspectRange', () => {
  it('says nothing about readable bounds in the right order', () => {
    expect(inspectBound('1 meter', 'min')).toBeNull()
    expect(inspectRange('1 meter', '2 meter')).toBeNull()
    expect(inspectRange(undefined, '2 meter')).toBeNull()
    expect(inspectRange('1 meter', undefined)).toBeNull()
  })

  it('describes an unreadable bound', () => {
    expect(inspectBound('tall', 'min')?.code).toBe('min-unparseable')
    expect(inspectBound('tall', 'max')?.code).toBe('max-unparseable')
  })

  /**
   * The bug this component exists not to have: `min="1 meter" max="80 inch"` is
   * a perfectly good range, and a string comparison would reject it.
   */
  it('compares bounds through the measurement, not the string', () => {
    expect(inspectRange('1 meter', '80 inch')).toBeNull()
    expect(inspectRange('80 inch', '1 meter')?.code).toBe('min-after-max')
  })

  it('rejects bounds that measure different things', () => {
    const warning = inspectRange('1 meter', '2 kilogram')
    expect(warning?.code).toBe('min-after-max')
    expect(warning?.message).toContain('different things')
  })

  it('leaves an unreadable bound to inspectBound rather than reporting it twice', () => {
    expect(inspectRange('tall', '2 meter')).toBeNull()
    expect(inspectRange('1 meter', 'tall')).toBeNull()
  })
})

describe('inspectOutOfRange', () => {
  it('says nothing about a value inside the range', () => {
    expect(inspectOutOfRange('71 inch', '1 meter', '2 meter')).toBeNull()
    expect(inspectOutOfRange('71 inch', undefined, undefined)).toBeNull()
  })

  it('names which end was missed', () => {
    expect(inspectOutOfRange('10 inch', '1 meter', undefined)?.message).toContain('smaller')
    expect(inspectOutOfRange('100 inch', undefined, '2 meter')?.message).toContain('larger')
  })
})

describe('inspectUnits', () => {
  it('says nothing about a well-formed array', () => {
    expect(inspectUnits(['foot', 'inch'])).toBeNull()
    expect(inspectUnits(['celsius'])).toBeNull()
  })

  it('points a time unit at the duration input', () => {
    const warning = inspectUnits(['hour', 'minute'])
    expect(warning?.code).toBe('units-not-convertible')
    expect(warning?.message).toContain('@rxova/react-duration-input')
  })

  it('explains percent and degree', () => {
    expect(inspectUnits(['percent'])?.code).toBe('units-not-convertible')
  })

  it('describes a unit that does not exist', () => {
    expect(inspectUnits(['furlong'])?.code).toBe('units-invalid')
    expect(inspectUnits([null])?.code).toBe('units-invalid')
    expect(inspectUnits([])?.code).toBe('units-invalid')
  })

  it('describes a mixed-dimension array', () => {
    const warning = inspectUnits(['meter', 'pound'])
    expect(warning?.code).toBe('units-dimension-mixed')
    expect(warning?.message).toContain('pound')
  })

  it('describes a multi-unit temperature field', () => {
    const warning = inspectUnits(['celsius', 'fahrenheit'])
    expect(warning?.code).toBe('units-temperature-multi')
    expect(warning?.message).toContain('two temperatures')
  })

  it('describes a pair with no whole-number ratio, and says what the ratio is', () => {
    const warning = inspectUnits(['meter', 'inch'])
    expect(warning?.code).toBe('units-ratio-not-integer')
    expect(warning?.message).toContain('39.37')
  })

  it('describes an array that only had to be reordered', () => {
    const warning = inspectUnits(['inch', 'foot'])
    expect(warning?.code).toBe('units-invalid')
    expect(warning?.message).toContain('largest-unit-first')
  })

  it('describes a duplicate', () => {
    expect(inspectUnits(['foot', 'foot'])?.code).toBe('units-invalid')
  })
})

describe('inspectPrecision and inspectStep', () => {
  it('says nothing about a usable precision', () => {
    for (const precision of [0, 1, 6]) expect(inspectPrecision(precision)).toBeNull()
  })

  it('describes a precision outside 0–6', () => {
    expect(inspectPrecision(-3)?.code).toBe('precision-invalid')
    expect(inspectPrecision(7)?.code).toBe('precision-invalid')
    expect(inspectPrecision(Number.NaN)?.code).toBe('precision-invalid')
    expect(inspectPrecision(1.5)?.code).toBe('precision-invalid')
  })

  it('says nothing about a step the smallest segment can land on', () => {
    expect(inspectStep(1, 0)).toBeNull()
    expect(inspectStep(5, 0)).toBeNull()
    expect(inspectStep(0.5, 1)).toBeNull()
  })

  it('describes a step that would walk off the grid', () => {
    // 0.25 in a field showing one decimal place: the first arrow press would
    // put a number on screen that disagrees with the value.
    expect(inspectStep(0.25, 1)?.code).toBe('step-invalid')
    expect(inspectStep(0, 0)?.code).toBe('step-invalid')
    expect(inspectStep(-1, 0)?.code).toBe('step-invalid')
    expect(inspectStep(Number.NaN, 0)?.code).toBe('step-invalid')
    expect(inspectStep(0.5, 0)?.message).toContain('Using 1')
  })
})

describe('inspectLocale', () => {
  it('says nothing about a real tag', () => {
    expect(inspectLocale('en-GB')).toBeNull()
  })

  it('describes the underscore mistake', () => {
    const warning = inspectLocale('en_US')
    expect(warning?.code).toBe('locale-invalid')
    expect(warning?.message).toContain('en-US')
  })
})
