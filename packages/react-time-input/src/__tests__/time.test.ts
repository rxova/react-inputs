import { describe, expect, it } from 'vitest'
import {
  AM,
  PM,
  compareISO,
  fromDisplayHour,
  fromISO,
  isComplete,
  pad,
  segmentRange,
  toDayPeriod,
  toDisplayHour,
  toISO,
  withinRange,
  wrap,
} from '../time'

/**
 * Pure clock arithmetic, so these run in the node project. The recurring theme
 * is that none of it goes through `Date`: a time of day is not an instant, and
 * every assertion below would depend on the machine's timezone if it were.
 */
describe('the 12/24-hour translation', () => {
  it('maps midnight and noon the way a clock face does', () => {
    // The two cases everyone gets wrong: 12 AM is hour 0, 12 PM is hour 12.
    expect(toDisplayHour(0, true)).toBe(12)
    expect(toDayPeriod(0)).toBe(AM)
    expect(toDisplayHour(12, true)).toBe(12)
    expect(toDayPeriod(12)).toBe(PM)
  })

  it('maps the ordinary hours', () => {
    expect(toDisplayHour(1, true)).toBe(1)
    expect(toDisplayHour(11, true)).toBe(11)
    expect(toDisplayHour(13, true)).toBe(1)
    expect(toDisplayHour(23, true)).toBe(11)
    expect(toDayPeriod(11)).toBe(AM)
    expect(toDayPeriod(13)).toBe(PM)
  })

  it('leaves a 24-hour field alone', () => {
    for (const hour of [0, 5, 12, 23]) expect(toDisplayHour(hour, false)).toBe(hour)
  })

  it('round-trips every hour of the day', () => {
    for (let hour = 0; hour <= 23; hour++) {
      expect(fromDisplayHour(toDisplayHour(hour, true), toDayPeriod(hour))).toBe(hour)
    }
  })

  it('folds the 12 before applying the period, not after', () => {
    // `12 + 12` would be 24. The fold has to happen first.
    expect(fromDisplayHour(12, AM)).toBe(0)
    expect(fromDisplayHour(12, PM)).toBe(12)
    expect(fromDisplayHour(1, PM)).toBe(13)
  })
})

describe('segmentRange', () => {
  it('bounds the hour by the clock in use', () => {
    expect(segmentRange('hour', true)).toEqual({ min: 1, max: 12 })
    expect(segmentRange('hour', false)).toEqual({ min: 0, max: 23 })
  })

  it('bounds minutes, seconds and the day period', () => {
    expect(segmentRange('minute', true)).toEqual({ min: 0, max: 59 })
    expect(segmentRange('second', false)).toEqual({ min: 0, max: 59 })
    expect(segmentRange('dayPeriod', true)).toEqual({ min: AM, max: PM })
  })
})

describe('toISO', () => {
  it('formats a complete time, always 24-hour and zero-padded', () => {
    expect(toISO({ hour: 14, minute: 30, second: null }, false)).toBe('14:30')
    expect(toISO({ hour: 9, minute: 5, second: null }, false)).toBe('09:05')
    expect(toISO({ hour: 0, minute: 0, second: null }, false)).toBe('00:00')
  })

  it('includes seconds only when the field has them', () => {
    expect(toISO({ hour: 14, minute: 30, second: 5 }, true)).toBe('14:30:05')
    // Seconds present in state but not shown: the value omits them, so the
    // canonical form matches the field the user is actually filling.
    expect(toISO({ hour: 14, minute: 30, second: 5 }, false)).toBe('14:30')
  })

  it('returns null while a needed segment is empty', () => {
    expect(toISO({ hour: 14, minute: null, second: null }, false)).toBeNull()
    expect(toISO({ hour: null, minute: 30, second: null }, false)).toBeNull()
    // Seconds shown but not filled.
    expect(toISO({ hour: 14, minute: 30, second: null }, true)).toBeNull()
  })

  it('refuses out-of-range numbers', () => {
    expect(toISO({ hour: 24, minute: 0, second: null }, false)).toBeNull()
    expect(toISO({ hour: -1, minute: 0, second: null }, false)).toBeNull()
    expect(toISO({ hour: 0, minute: 60, second: null }, false)).toBeNull()
    expect(toISO({ hour: 0, minute: 0, second: 60 }, true)).toBeNull()
  })
})

describe('fromISO', () => {
  it('parses both precisions', () => {
    expect(fromISO('14:30')).toEqual({ hour: 14, minute: 30, second: null })
    expect(fromISO('14:30:05')).toEqual({ hour: 14, minute: 30, second: 5 })
  })

  it('rejects display formats, which are locale-dependent', () => {
    // Accepting these would make the prop's meaning depend on the locale.
    for (const bad of ['2:30 PM', '2:30pm', '9:05', '14.30', '1430', '', 'noon']) {
      expect(fromISO(bad)).toBeNull()
    }
  })

  it('rejects impossible clock readings', () => {
    expect(fromISO('24:00')).toBeNull()
    expect(fromISO('23:60')).toBeNull()
    expect(fromISO('23:59:60')).toBeNull()
    expect(fromISO('23:59:59')).toEqual({ hour: 23, minute: 59, second: 59 })
  })

  it('round-trips with toISO', () => {
    for (const value of ['00:00', '09:05', '14:30', '23:59']) {
      expect(toISO(fromISO(value)!, false)).toBe(value)
    }
    expect(toISO(fromISO('23:59:59')!, true)).toBe('23:59:59')
  })
})

describe('compareISO and withinRange', () => {
  it('orders times chronologically by comparing strings', () => {
    expect(compareISO('09:00', '14:30')).toBe(-1)
    expect(compareISO('14:30', '09:00')).toBe(1)
    expect(compareISO('14:30', '14:30')).toBe(0)
    expect(compareISO('23:59', '00:00')).toBe(1)
  })

  it('compares across precisions on the shared prefix', () => {
    // A bound given without seconds must still order correctly against a value
    // that has them.
    expect(compareISO('14:30:00', '14:30')).toBe(0)
    expect(compareISO('14:30:59', '14:31')).toBe(-1)
  })

  it('treats both bounds as inclusive', () => {
    expect(withinRange('09:00', '09:00', '17:00')).toBe(true)
    expect(withinRange('17:00', '09:00', '17:00')).toBe(true)
    expect(withinRange('08:59', '09:00', '17:00')).toBe(false)
    expect(withinRange('17:01', '09:00', '17:00')).toBe(false)
  })

  it('treats an absent bound as unbounded', () => {
    expect(withinRange('00:00', undefined, '17:00')).toBe(true)
    expect(withinRange('23:59', '09:00', undefined)).toBe(true)
    expect(withinRange('12:00')).toBe(true)
  })
})

describe('wrap', () => {
  it('wraps at both ends of an inclusive range', () => {
    expect(wrap(60, 0, 59)).toBe(0)
    expect(wrap(-1, 0, 59)).toBe(59)
    expect(wrap(13, 1, 12)).toBe(1)
    expect(wrap(0, 1, 12)).toBe(12)
  })

  it('wraps the two-state day period', () => {
    expect(wrap(PM + 1, AM, PM)).toBe(AM)
    expect(wrap(AM - 1, AM, PM)).toBe(PM)
  })
})

describe('helpers', () => {
  it('pads to the requested width', () => {
    expect(pad(5, 2)).toBe('05')
    expect(pad(59, 2)).toBe('59')
  })

  it('reports completeness against the field shape', () => {
    const parts = { hour: 14, minute: 30, second: null }
    expect(isComplete(parts, false)).toBe(true)
    // Seconds are shown, so the time is not finished.
    expect(isComplete(parts, true)).toBe(false)
    expect(isComplete({ ...parts, second: 0 }, true)).toBe(true)
    expect(isComplete({ hour: null, minute: 30, second: null }, false)).toBe(false)
  })
})
