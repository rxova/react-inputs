import { describe, expect, it } from 'vitest'
import { inspectLocale, inspectReferenceDate, inspectValue, inspectZones } from '../warn'
import { ZONES, resolveZone } from '../zones'

describe('inspectValue', () => {
  it('says nothing about a zone the field lists', () => {
    expect(inspectValue('Europe/Madrid', 'value')).toBeNull()
    expect(inspectValue('UTC', 'value')).toBeNull()
  })

  /**
   * The case that would otherwise be unreachable. `Intl` *accepts* `+02:00` as
   * a time zone, so an `isUsableZone` check ahead of this one would have let it
   * straight through — which is how the ordering bug was found.
   */
  it('names an offset as the mistake it is', () => {
    for (const offset of ['+02:00', '-05:00', '+0200', 'GMT+2', 'UTC-3']) {
      const warning = inspectValue(offset, 'value')
      expect(warning?.code).toBe('value-offset-not-zone')
      expect(warning?.message).toContain('America/New_York')
    }
  })

  it('explains the Etc/GMT sign inversion with the real offset', () => {
    const warning = inspectValue('Etc/GMT+5', 'value')
    expect(warning?.code).toBe('value-etc-inverted')
    // The point of the message: the id reads +5 and the zone is UTC−5.
    expect(warning?.message).toContain('UTC-5')
  })

  it('gets the sign right in both directions', () => {
    // `Etc/GMT-5` is UTC+5, so the message has to say `+5` rather than `-5`.
    expect(inspectValue('Etc/GMT-5', 'value')?.message).toContain('UTC+5')
    expect(inspectValue('Etc/GMT+5', 'value')?.message).toContain('UTC-5')
  })

  /**
   * There is deliberately no "usable but unlisted" warning: every id the engine
   * accepts canonicalises onto one it lists, except the `Etc/GMT±N` zones, which
   * the sign-inversion branch above already explains better.
   */
  it('says nothing about a legacy id that canonicalises onto a listed zone', () => {
    expect(inspectValue('US/Eastern', 'value')).toBeNull()
    expect(ZONES).toContain(resolveZone('US/Eastern'))
  })

  it('describes a zone the engine does not recognise', () => {
    const warning = inspectValue('Mars/Olympus', 'value')
    expect(warning?.code).toBe('value-unknown-zone')
    expect(warning?.message).toContain('Europe/Madrid')
  })

  it('describes a non-string without throwing on it', () => {
    for (const value of [5, null, {}, [], undefined]) {
      expect(() => inspectValue(value, 'value')).not.toThrow()
    }
    expect(inspectValue(5, 'value')?.code).toBe('value-unknown-zone')
    expect(inspectValue(undefined, 'value')?.received).toBe('undefined')
  })

  it('quotes a circular object rather than throwing while explaining it', () => {
    const circular: Record<string, unknown> = {}
    circular.self = circular
    expect(inspectValue(circular, 'value')?.received).toBe('[object Object]')
  })

  it('carries the prop name it was given', () => {
    expect(inspectValue('nope', 'defaultValue')?.prop).toBe('defaultValue')
  })
})

describe('inspectZones', () => {
  it('says nothing about a list of real zones', () => {
    expect(inspectZones(['Europe/Madrid', 'UTC'])).toBeNull()
  })

  it('describes an entry the engine does not recognise', () => {
    const warning = inspectZones(['Europe/Madrid', 'Mars/Olympus'])
    expect(warning?.code).toBe('zones-invalid')
    expect(warning?.message).toContain('Mars/Olympus')
  })

  it('describes an entry that is not a string at all', () => {
    expect(inspectZones([null])?.code).toBe('zones-invalid')
    expect(inspectZones([undefined])?.code).toBe('zones-invalid')
    expect(inspectZones([5, 'Europe/Madrid'])?.code).toBe('zones-invalid')
  })

  it('describes an empty list', () => {
    const warning = inspectZones([])
    expect(warning?.code).toBe('zones-empty')
  })
})

describe('inspectReferenceDate', () => {
  it('says nothing about a real date', () => {
    expect(inspectReferenceDate(new Date())).toBeNull()
  })

  /**
   * `Invalid Date` is the one that gets through typing: it passes
   * `instanceof Date`, so TypeScript is satisfied, and then every `Intl` call
   * made with it throws.
   *
   * Note which strings actually produce one — `new Date('2026-02-30')` does
   * *not*, because V8 rolls it over to 2 March. An out-of-range month does.
   */
  it('describes an Invalid Date, which is the one that gets through typing', () => {
    expect(new Date('2026-02-30').getTime()).not.toBeNaN()
    expect(inspectReferenceDate(new Date('2026-13-01'))?.code).toBe('reference-date-invalid')
    expect(inspectReferenceDate(new Date('nonsense'))?.code).toBe('reference-date-invalid')
    expect(inspectReferenceDate(new Date(Number.NaN))?.code).toBe('reference-date-invalid')
  })

  it('describes something that is not a date at all', () => {
    for (const value of [0, '2026-01-01', null, {}]) {
      expect(inspectReferenceDate(value)?.code).toBe('reference-date-invalid')
    }
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
