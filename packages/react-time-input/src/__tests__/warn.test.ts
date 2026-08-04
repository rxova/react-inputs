import { describe, expect, it } from 'vitest'
import {
  inspectBound,
  inspectLocale,
  inspectOutOfRange,
  inspectRange,
  inspectStep,
  inspectValue,
} from '../warn'

/**
 * These inspectors only *describe* a coercion the hook has already applied, so
 * the contract is: a usable prop returns `null`, and an unusable one returns a
 * warning naming what arrived and what happens instead.
 */
describe('inspectValue', () => {
  it('passes a well-formed 24-hour value', () => {
    expect(inspectValue('14:30', 'value')).toBeNull()
    expect(inspectValue('14:30:05', 'value')).toBeNull()
  })

  it('recognises a display format and shows the 24-hour equivalent', () => {
    // The most likely mistake, so the message has to teach the fix.
    const warning = inspectValue('2:30 PM', 'value')
    expect(warning?.code).toBe('value-unparseable')
    expect(warning?.message).toContain('14:30')
  })

  it('recognises an unpadded value as a display format too', () => {
    expect(inspectValue('9:05', 'value')?.message).toContain('14:30')
  })

  it('gives a plainer message for something that is not a time at all', () => {
    const warning = inspectValue('nonsense', 'defaultValue')
    expect(warning?.prop).toBe('defaultValue')
    expect(warning?.message).not.toContain('display format')
  })
})

describe('inspectBound', () => {
  it('passes real times', () => {
    expect(inspectBound('09:00', 'min')).toBeNull()
    expect(inspectBound('17:00:30', 'max')).toBeNull()
  })

  it('uses a different code per prop, so a switch can tell them apart', () => {
    expect(inspectBound('nope', 'min')?.code).toBe('min-unparseable')
    expect(inspectBound('nope', 'max')?.code).toBe('max-unparseable')
  })
})

describe('inspectRange', () => {
  it('passes an ordered or absent range', () => {
    expect(inspectRange('09:00', '17:00')).toBeNull()
    expect(inspectRange('09:00', '09:00')).toBeNull()
    expect(inspectRange(undefined, '17:00')).toBeNull()
    expect(inspectRange('09:00', undefined)).toBeNull()
  })

  it('says nothing when a bound is unparseable, because that is reported already', () => {
    // Otherwise one typo would produce two warnings saying different things.
    expect(inspectRange('nope', '17:00')).toBeNull()
    expect(inspectRange('09:00', 'nope')).toBeNull()
  })

  it('reports an inverted range and names the midnight limitation', () => {
    const warning = inspectRange('22:00', '06:00')
    expect(warning?.code).toBe('min-after-max')
    expect(warning?.message).toContain('midnight')
  })
})

describe('inspectOutOfRange', () => {
  it('passes a time inside the range', () => {
    expect(inspectOutOfRange('12:00', '09:00', '17:00')).toBeNull()
    expect(inspectOutOfRange('12:00', undefined, undefined)).toBeNull()
  })

  it('distinguishes too early from too late in the message', () => {
    expect(inspectOutOfRange('07:00', '09:00', undefined)?.message).toContain('before')
    expect(inspectOutOfRange('19:00', undefined, '17:00')?.message).toContain('after')
  })
})

describe('inspectStep', () => {
  it('passes a step that divides an hour', () => {
    for (const step of [1, 5, 10, 15, 20, 30, 60]) {
      expect(inspectStep(step, 'minuteStep')).toBeNull()
    }
  })

  it('rejects a step that leaves an uneven bucket at the top of the hour', () => {
    for (const step of [7, 8, 45, 0, -5, 1.5, 61]) {
      expect(inspectStep(step, 'minuteStep')?.code).toBe('step-invalid')
    }
  })

  it('names the prop it was given', () => {
    expect(inspectStep(7, 'secondStep')?.prop).toBe('secondStep')
  })
})

describe('inspectLocale', () => {
  it('passes a well-formed tag', () => {
    expect(inspectLocale('en-US')).toBeNull()
  })

  it('reports a tag Intl refuses and points at the hyphen', () => {
    expect(inspectLocale('en_US')?.message).toContain('en-US')
  })
})
