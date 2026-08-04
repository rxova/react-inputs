import { describe, expect, it } from 'vitest'
import {
  MAX_YEAR,
  MIN_YEAR,
  clampDay,
  compareISO,
  daysInMonth,
  fromISO,
  isComplete,
  isLeapYear,
  pad,
  segmentRange,
  segmentWidth,
  toISO,
  withinRange,
  wrap,
} from '../date'

/**
 * Pure calendar arithmetic, so these run in the node project. The recurring
 * theme is that none of it may go through `Date`: every assertion below would
 * pass or fail differently depending on the machine's timezone if it did.
 */
describe('isLeapYear', () => {
  it('follows the proleptic Gregorian rule, including the century exceptions', () => {
    expect(isLeapYear(2024)).toBe(true)
    expect(isLeapYear(2023)).toBe(false)
    // Divisible by 100 but not 400 — the rule everyone forgets.
    expect(isLeapYear(1900)).toBe(false)
    expect(isLeapYear(2100)).toBe(false)
    // Divisible by 400.
    expect(isLeapYear(2000)).toBe(true)
    expect(isLeapYear(1600)).toBe(true)
  })
})

describe('daysInMonth', () => {
  it('knows the ordinary months', () => {
    expect(daysInMonth(2026, 1)).toBe(31)
    expect(daysInMonth(2026, 4)).toBe(30)
    expect(daysInMonth(2026, 12)).toBe(31)
  })

  it('knows February in both kinds of year', () => {
    expect(daysInMonth(2024, 2)).toBe(29)
    expect(daysInMonth(2023, 2)).toBe(28)
    expect(daysInMonth(1900, 2)).toBe(28)
    expect(daysInMonth(2000, 2)).toBe(29)
  })

  it('allows 29 for February when the year is not known yet', () => {
    // The user types the day first. Narrowing to 28 before they have said
    // which year would reject a 29 that is about to become valid.
    expect(daysInMonth(null, 2)).toBe(29)
  })

  it('allows 31 when the month is not known yet', () => {
    expect(daysInMonth(2026, null)).toBe(31)
    expect(daysInMonth(null, null)).toBe(31)
  })

  it('falls back to 31 for a month outside 1–12', () => {
    expect(daysInMonth(2026, 0)).toBe(31)
    expect(daysInMonth(2026, 13)).toBe(31)
  })
})

describe('segmentRange', () => {
  it('bounds each segment', () => {
    const parts = { year: 2024, month: 2, day: null }
    expect(segmentRange('year', parts)).toEqual({ min: MIN_YEAR, max: MAX_YEAR })
    expect(segmentRange('month', parts)).toEqual({ min: 1, max: 12 })
    expect(segmentRange('day', parts)).toEqual({ min: 1, max: 29 })
  })

  it('narrows the day range as the month and year arrive', () => {
    expect(segmentRange('day', { year: null, month: null, day: null }).max).toBe(31)
    expect(segmentRange('day', { year: null, month: 2, day: null }).max).toBe(29)
    expect(segmentRange('day', { year: 2023, month: 2, day: null }).max).toBe(28)
  })
})

describe('toISO', () => {
  it('formats a complete, real date', () => {
    expect(toISO({ year: 2026, month: 3, day: 1 })).toBe('2026-03-01')
    expect(toISO({ year: 7, month: 12, day: 31 })).toBe('0007-12-31')
  })

  it('returns null while any segment is empty', () => {
    expect(toISO({ year: 2026, month: 3, day: null })).toBeNull()
    expect(toISO({ year: null, month: 3, day: 1 })).toBeNull()
    expect(toISO({ year: 2026, month: null, day: 1 })).toBeNull()
  })

  it('refuses a day the month does not have, instead of rolling over', () => {
    // `new Date(2026, 1, 31)` silently becomes 3 March. That rollover is how a
    // date field ends up submitting a month the user never chose.
    expect(toISO({ year: 2026, month: 2, day: 31 })).toBeNull()
    expect(toISO({ year: 2023, month: 2, day: 29 })).toBeNull()
    expect(toISO({ year: 2024, month: 2, day: 29 })).toBe('2024-02-29')
    expect(toISO({ year: 2026, month: 4, day: 31 })).toBeNull()
  })

  it('refuses out-of-range segments', () => {
    expect(toISO({ year: 0, month: 1, day: 1 })).toBeNull()
    expect(toISO({ year: 10000, month: 1, day: 1 })).toBeNull()
    expect(toISO({ year: 2026, month: 0, day: 1 })).toBeNull()
    expect(toISO({ year: 2026, month: 13, day: 1 })).toBeNull()
    expect(toISO({ year: 2026, month: 1, day: 0 })).toBeNull()
  })
})

describe('fromISO', () => {
  it('parses a well-formed date', () => {
    expect(fromISO('2026-03-01')).toEqual({ year: 2026, month: 3, day: 1 })
  })

  it('is not timezone-sensitive', () => {
    // The bug this whole module exists to avoid: `new Date('2026-03-01')` is
    // UTC midnight, so `.getDate()` is 28 anywhere west of Greenwich.
    expect(fromISO('2026-03-01')?.day).toBe(1)
    expect(fromISO('2026-01-01')?.year).toBe(2026)
  })

  it('rejects anything that is not exactly YYYY-MM-DD', () => {
    for (const bad of [
      '',
      '2026-3-1',
      '26-03-01',
      '2026/03/01',
      '03/01/2026',
      '2026-03-01T00:00:00Z',
      'yesterday',
    ]) {
      expect(fromISO(bad)).toBeNull()
    }
  })

  it('rejects a well-formed string for a day that does not exist', () => {
    expect(fromISO('2026-02-31')).toBeNull()
    expect(fromISO('2023-02-29')).toBeNull()
    expect(fromISO('2024-02-29')).toEqual({ year: 2024, month: 2, day: 29 })
  })

  it('round-trips with toISO', () => {
    for (const iso of ['2026-03-01', '2024-02-29', '0001-01-01', '9999-12-31']) {
      expect(toISO(fromISO(iso)!)).toBe(iso)
    }
  })
})

describe('compareISO and withinRange', () => {
  it('orders dates chronologically by comparing strings', () => {
    expect(compareISO('2026-01-01', '2026-01-02')).toBe(-1)
    expect(compareISO('2026-01-02', '2026-01-01')).toBe(1)
    expect(compareISO('2026-01-01', '2026-01-01')).toBe(0)
    // Across boundaries where a naive numeric comparison would fail.
    expect(compareISO('2025-12-31', '2026-01-01')).toBe(-1)
    expect(compareISO('2026-09-30', '2026-10-01')).toBe(-1)
  })

  it('treats both bounds as inclusive', () => {
    expect(withinRange('2026-01-01', '2026-01-01', '2026-12-31')).toBe(true)
    expect(withinRange('2026-12-31', '2026-01-01', '2026-12-31')).toBe(true)
    expect(withinRange('2025-12-31', '2026-01-01', '2026-12-31')).toBe(false)
    expect(withinRange('2027-01-01', '2026-01-01', '2026-12-31')).toBe(false)
  })

  it('treats an absent bound as unbounded', () => {
    expect(withinRange('0001-01-01', undefined, '2026-12-31')).toBe(true)
    expect(withinRange('9999-12-31', '2026-01-01', undefined)).toBe(true)
    expect(withinRange('2026-06-15')).toBe(true)
  })
})

describe('clampDay', () => {
  it('pulls the day back when the month can no longer hold it', () => {
    // 31 January, then the user switches to February. Clamping keeps the month
    // they just chose; rolling over to 3 March would silently undo it.
    expect(clampDay({ year: 2026, month: 2, day: 31 })).toEqual({
      year: 2026,
      month: 2,
      day: 28,
    })
    expect(clampDay({ year: 2024, month: 2, day: 31 })).toEqual({
      year: 2024,
      month: 2,
      day: 29,
    })
  })

  it('leaves a day the month can hold', () => {
    const parts = { year: 2026, month: 1, day: 31 }
    expect(clampDay(parts)).toBe(parts)
  })

  it('leaves an empty day alone', () => {
    const parts = { year: 2026, month: 2, day: null }
    expect(clampDay(parts)).toBe(parts)
  })
})

describe('wrap', () => {
  it('wraps at both ends of an inclusive range', () => {
    expect(wrap(13, 1, 12)).toBe(1)
    expect(wrap(0, 1, 12)).toBe(12)
    expect(wrap(6, 1, 12)).toBe(6)
    expect(wrap(-1, 1, 12)).toBe(11)
  })

  it('handles a range starting at zero', () => {
    expect(wrap(-1, 0, 59)).toBe(59)
    expect(wrap(60, 0, 59)).toBe(0)
  })
})

describe('formatting helpers', () => {
  it('pads to the requested width', () => {
    expect(pad(1, 2)).toBe('01')
    expect(pad(2026, 4)).toBe('2026')
    expect(pad(7, 4)).toBe('0007')
    // Already wide enough — never truncated.
    expect(pad(12345, 4)).toBe('12345')
  })

  it('knows how many digits each segment holds', () => {
    expect(segmentWidth('year')).toBe(4)
    expect(segmentWidth('month')).toBe(2)
    expect(segmentWidth('day')).toBe(2)
  })

  it('reports completeness independently of validity', () => {
    // All three filled, but 31 February is not a date. `isComplete` is about
    // whether the user has finished typing, `toISO` about whether it is real.
    expect(isComplete({ year: 2026, month: 2, day: 31 })).toBe(true)
    expect(toISO({ year: 2026, month: 2, day: 31 })).toBeNull()
    expect(isComplete({ year: 2026, month: 2, day: null })).toBe(false)
  })
})
