import { describe, expect, it } from 'vitest'
import {
  inspectBound,
  inspectLocale,
  inspectOutOfRange,
  inspectRange,
  inspectStep,
  inspectTruncation,
  inspectUnits,
  inspectValue,
} from '../warn'

describe('inspectValue', () => {
  it('says nothing about a duration it can read', () => {
    expect(inspectValue('PT1H30M', 'value')).toBeNull()
    expect(inspectValue('PT0S', 'value')).toBeNull()
  })

  /**
   * The message that earns this module's keep. Someone writing `P1M` for one
   * minute gets a field showing nothing and no idea why; the ISO answer is that
   * they asked for a month.
   */
  it('names the month/minute trap by its own rule', () => {
    const warning = inspectValue('P1M', 'value')
    expect(warning?.code).toBe('value-calendar-unit')
    expect(warning?.message).toContain('PT1M')
    expect(warning?.message).toContain('month')
  })

  it('reports years the same way', () => {
    expect(inspectValue('P1Y', 'defaultValue')?.code).toBe('value-calendar-unit')
  })

  it('recognises a bare number as someone passing seconds', () => {
    const warning = inspectValue('5400', 'value')
    expect(warning?.code).toBe('value-unparseable')
    expect(warning?.message).toContain('bare number')
    expect(warning?.message).toContain('PT5400S')
  })

  it('recognises a clock format', () => {
    expect(inspectValue('90:00', 'value')?.message).toContain('clock format')
  })

  it('falls back to the generic message for anything else', () => {
    const warning = inspectValue('garbage', 'value')
    expect(warning?.code).toBe('value-unparseable')
    expect(warning?.message).toContain('ISO 8601')
  })

  it('names the prop it was given', () => {
    expect(inspectValue('garbage', 'defaultValue')?.prop).toBe('defaultValue')
  })

  /**
   * A diagnostic that throws while explaining a bad prop is the worst of both,
   * so the value is stringified before anything touches it.
   */
  it.each([[5400], [{}], [[]], [true], [Number.NaN]])(
    'describes a %s that is not a string at all',
    (value) => {
      const warning = inspectValue(value, 'value')
      expect(warning?.code).toBe('value-unparseable')
      expect(typeof warning?.received).toBe('string')
    },
  )
})

describe('inspectTruncation', () => {
  it('says nothing when the units hold the value exactly', () => {
    expect(inspectTruncation('PT1H30M', ['hour', 'minute'], 'value')).toBeNull()
  })

  it('warns when the value is finer than the smallest unit shown', () => {
    const warning = inspectTruncation('PT90S', ['hour', 'minute'], 'value')
    expect(warning?.code).toBe('value-truncated')
    expect(warning?.message).toContain('minute')
  })

  it('says nothing about a value it cannot read — inspectValue owns that', () => {
    expect(inspectTruncation('garbage', ['minute'], 'value')).toBeNull()
  })

  it('suggests seconds specifically when minutes are the floor', () => {
    expect(inspectTruncation('PT30S', ['minute'], 'value')?.message).toContain("'second'")
  })

  it('stays vague when the floor is coarser than a minute', () => {
    const warning = inspectTruncation('PT30M', ['hour'], 'value')
    expect(warning?.message).toContain('a smaller unit')
    expect(warning?.message).toContain('hours')
  })
})

describe('inspectBound', () => {
  it('says nothing about a bound it can read', () => {
    expect(inspectBound('PT15M', 'min')).toBeNull()
  })

  it('reports an unreadable min and max under their own codes', () => {
    expect(inspectBound('garbage', 'min')?.code).toBe('min-unparseable')
    expect(inspectBound('garbage', 'max')?.code).toBe('max-unparseable')
  })
})

describe('inspectRange', () => {
  it('says nothing about a satisfiable range', () => {
    expect(inspectRange('PT15M', 'PT2H')).toBeNull()
    expect(inspectRange('PT2H', 'PT2H')).toBeNull()
  })

  /**
   * The specific bug a lexical comparison would introduce: `PT10M` sorts after
   * `PT2H` as a string, so a string-based check would call this good range
   * impossible and drop both bounds.
   */
  it('accepts a range a string comparison would reject', () => {
    expect(inspectRange('PT10M', 'PT2H')).toBeNull()
  })

  it('reports a range nothing can satisfy', () => {
    const warning = inspectRange('PT2H', 'PT15M')
    expect(warning?.code).toBe('min-after-max')
  })

  it('says nothing when either bound is missing or unreadable', () => {
    expect(inspectRange(undefined, 'PT2H')).toBeNull()
    expect(inspectRange('PT2H', undefined)).toBeNull()
    expect(inspectRange('garbage', 'PT15M')).toBeNull()
    expect(inspectRange('PT2H', 'garbage')).toBeNull()
  })
})

describe('inspectOutOfRange', () => {
  it('says nothing about a value inside the range', () => {
    expect(inspectOutOfRange('PT30M', 'PT15M', 'PT2H')).toBeNull()
    expect(inspectOutOfRange('PT30M', undefined, undefined)).toBeNull()
  })

  it('reports a value that is too short and one that is too long', () => {
    expect(inspectOutOfRange('PT5M', 'PT15M', undefined)?.message).toContain('shorter')
    expect(inspectOutOfRange('PT5H', undefined, 'PT2H')?.message).toContain('longer')
  })

  it('uses the same code for both directions, so a switch has one arm', () => {
    expect(inspectOutOfRange('PT5M', 'PT15M', 'PT2H')?.code).toBe('value-out-of-range')
    expect(inspectOutOfRange('PT5H', 'PT15M', 'PT2H')?.code).toBe('value-out-of-range')
  })
})

describe('inspectUnits', () => {
  it('says nothing about a well-formed array', () => {
    expect(inspectUnits(['hour', 'minute'])).toBeNull()
    expect(inspectUnits(['day', 'hour', 'minute', 'second'])).toBeNull()
  })

  it('reports a unit it does not know, and says why months are absent', () => {
    const warning = inspectUnits(['hour', 'month'])
    expect(warning?.code).toBe('units-invalid')
    expect(warning?.message).toContain('"month"')
    expect(warning?.message).toContain('fixed number of seconds')
  })

  it('reports a non-string entry without throwing on it', () => {
    expect(inspectUnits([null, 3, undefined])?.code).toBe('units-invalid')
  })

  it('reports an empty array', () => {
    expect(inspectUnits([])?.message).toContain('empty')
  })

  it('reports a reordering, because the field silently renders it correctly', () => {
    const warning = inspectUnits(['minute', 'hour'])
    expect(warning?.code).toBe('units-invalid')
    expect(warning?.message).toContain('largest-unit-first')
  })

  it('reports a duplicate', () => {
    expect(inspectUnits(['hour', 'hour'])?.code).toBe('units-invalid')
  })
})

describe('inspectStep', () => {
  it('accepts every step that divides 60', () => {
    for (const step of [1, 2, 3, 4, 5, 6, 10, 12, 15, 20, 30, 60]) {
      expect(inspectStep(step, 'minuteStep')).toBeNull()
    }
  })

  it('rejects a step that leaves an uneven bucket', () => {
    expect(inspectStep(7, 'minuteStep')?.code).toBe('step-invalid')
    expect(inspectStep(0, 'minuteStep')?.code).toBe('step-invalid')
    expect(inspectStep(-5, 'secondStep')?.code).toBe('step-invalid')
    expect(inspectStep(1.5, 'minuteStep')?.code).toBe('step-invalid')
    expect(inspectStep(Number.NaN, 'minuteStep')?.code).toBe('step-invalid')
    expect(inspectStep(90, 'minuteStep')?.code).toBe('step-invalid')
  })
})

describe('inspectLocale', () => {
  it('says nothing about a tag Intl accepts', () => {
    expect(inspectLocale('en-GB')).toBeNull()
  })

  it('reports an underscore, which is the usual mistake', () => {
    const warning = inspectLocale('en_US')
    expect(warning?.code).toBe('locale-invalid')
    expect(warning?.message).toContain('en-US')
  })
})
