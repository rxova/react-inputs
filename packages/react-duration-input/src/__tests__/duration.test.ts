import { describe, expect, it } from 'vitest'
import {
  EMPTY_PARTS,
  UNIT_ORDER,
  UNIT_SECONDS,
  clamp,
  compareDurations,
  durationToSeconds,
  fitsUnits,
  fromISODuration,
  isComplete,
  isEmpty,
  normalise,
  pad,
  parseISODuration,
  secondsToDuration,
  toISODuration,
  toSeconds,
  unitRange,
  unitWidth,
  withinDurationRange,
} from '../duration'
import type { DurationParts, DurationUnit } from '../duration'

const parts = (input: Partial<Record<DurationUnit, number>>): DurationParts => ({
  ...EMPTY_PARTS,
  ...input,
})

describe('parseISODuration', () => {
  it.each([
    ['PT0S', 0],
    ['PT1S', 1],
    ['PT1M', 60],
    ['PT90M', 5400],
    ['PT1H', 3600],
    ['PT1H30M', 5400],
    ['PT1H30M15S', 5415],
    ['P1D', 86_400],
    ['P2DT4H', 187_200],
    ['P1W', 604_800],
    ['P1WT1H', 608_400],
    ['PT36H', 129_600],
    ['PT0H0M0S', 0],
    ['P0D', 0],
  ])('reads %s as %i seconds', (input, expected) => {
    expect(parseISODuration(input)).toEqual({ ok: true, seconds: expected })
  })

  /**
   * The whole reason this parser is hand-written. `P1M` is one month and
   * `PT1M` is one minute — a 43,200× difference hiding behind one character.
   */
  it('reads PT1M as a minute and refuses P1M as a month', () => {
    expect(parseISODuration('PT1M')).toEqual({ ok: true, seconds: 60 })
    expect(parseISODuration('P1M')).toEqual({ ok: false, error: 'calendar-unit' })
  })

  it.each(['P1Y', 'P1M', 'P1Y6M', 'P1YT1H', 'P1M1DT1H'])(
    'refuses %s as a calendar unit rather than approximating it',
    (input) => {
      expect(parseISODuration(input)).toEqual({ ok: false, error: 'calendar-unit' })
    },
  )

  it.each([
    '',
    'P',
    'PT',
    '1H',
    'PT1',
    'H1',
    'garbage',
    'PT1H30',
    '90:00',
    '90',
    'P1H',
    'PT1D',
    'PTM',
    'P-1D',
    'PT1H 30M',
    'p1d',
    'PT1.5.5S',
  ])('refuses %s as malformed', (input) => {
    expect(parseISODuration(input)).toEqual({ ok: false, error: 'malformed' })
  })

  it('refuses a negative duration rather than making it positive', () => {
    expect(parseISODuration('-PT1H')).toEqual({ ok: false, error: 'malformed' })
  })

  it('accepts a leading plus, which ISO 8601 allows', () => {
    expect(parseISODuration('+PT1H')).toEqual({ ok: true, seconds: 3600 })
  })

  it('accepts fractional components and floors them to the second', () => {
    expect(parseISODuration('PT1.5H')).toEqual({ ok: true, seconds: 5400 })
    expect(parseISODuration('PT0.5S')).toEqual({ ok: true, seconds: 0 })
    expect(parseISODuration('PT1.75M')).toEqual({ ok: true, seconds: 105 })
  })

  it('accepts a comma as the decimal separator, as ISO 8601 prefers', () => {
    expect(parseISODuration('PT1,5H')).toEqual(parseISODuration('PT1.5H'))
  })

  it('ignores surrounding whitespace', () => {
    expect(parseISODuration('  PT1H  ')).toEqual({ ok: true, seconds: 3600 })
  })

  it('accepts a duration far larger than a day', () => {
    expect(parseISODuration('P365D')).toEqual({ ok: true, seconds: 31_536_000 })
  })

  /**
   * Well-formed and unrepresentable. `Number` saturates to `Infinity` long
   * before this many digits, and an `Infinity` duration would propagate through
   * every comparison as neither shorter nor longer than anything.
   */
  it('refuses a number of digits that overflows a double', () => {
    expect(parseISODuration(`PT${'9'.repeat(400)}H`)).toEqual({
      ok: false,
      error: 'malformed',
    })
  })
})

describe('toISODuration', () => {
  it('writes the shortest legal form', () => {
    expect(toISODuration(parts({ hour: 1, minute: 30 }), ['hour', 'minute'])).toBe('PT1H30M')
    expect(toISODuration(parts({ hour: 2, minute: 0 }), ['hour', 'minute'])).toBe('PT2H')
    expect(toISODuration(parts({ hour: 0, minute: 5 }), ['hour', 'minute'])).toBe('PT5M')
  })

  it('writes PT0S for a zero duration, not the ambiguous P or P0D', () => {
    expect(toISODuration(parts({ hour: 0, minute: 0 }), ['hour', 'minute'])).toBe('PT0S')
    expect(toISODuration(parts({ second: 0 }), ['second'])).toBe('PT0S')
  })

  it('puts days before the T and everything else after it', () => {
    expect(toISODuration(parts({ day: 2, hour: 4 }), ['day', 'hour'])).toBe('P2DT4H')
    expect(toISODuration(parts({ day: 2, hour: 0 }), ['day', 'hour'])).toBe('P2D')
  })

  it('returns null while any shown unit is empty', () => {
    expect(toISODuration(parts({ hour: 1 }), ['hour', 'minute'])).toBeNull()
    expect(toISODuration(EMPTY_PARTS, ['minute'])).toBeNull()
  })

  it('ignores units the field does not show', () => {
    // A value arriving with seconds, rendered in an h:m field, still writes
    // only what the field owns — otherwise the field would emit a duration the
    // user cannot see or edit.
    expect(toISODuration(parts({ hour: 1, minute: 0 }), ['hour', 'minute'])).toBe('PT1H')
  })

  it('returns null for a negative or non-finite component', () => {
    expect(toISODuration(parts({ minute: -1 }), ['minute'])).toBeNull()
    expect(toISODuration(parts({ minute: Number.NaN }), ['minute'])).toBeNull()
    expect(toISODuration(parts({ minute: Infinity }), ['minute'])).toBeNull()
  })

  it('round-trips every value it produces', () => {
    for (const seconds of [0, 1, 59, 60, 61, 3599, 3600, 5400, 86_399, 86_400, 187_200]) {
      const units: DurationUnit[] = ['day', 'hour', 'minute', 'second']
      const iso = toISODuration(secondsToDuration(seconds, units), units)
      expect(iso).not.toBeNull()
      expect(toSeconds(iso!)).toBe(seconds)
    }
  })
})

describe('secondsToDuration', () => {
  it('splits across the units a field shows', () => {
    expect(secondsToDuration(5415, ['hour', 'minute', 'second'])).toEqual(
      parts({ hour: 1, minute: 30, second: 15 }),
    )
  })

  it('folds everything into the largest shown unit when it is alone', () => {
    expect(secondsToDuration(5400, ['minute'])).toEqual(parts({ minute: 90 }))
    expect(secondsToDuration(187_200, ['hour'])).toEqual(parts({ hour: 52 }))
  })

  it('truncates rather than rounding what the units cannot hold', () => {
    expect(secondsToDuration(90, ['hour', 'minute'])).toEqual(parts({ hour: 0, minute: 1 }))
    expect(secondsToDuration(119, ['minute'])).toEqual(parts({ minute: 1 }))
  })

  it('floors a fractional input and refuses to go negative', () => {
    expect(secondsToDuration(90.9, ['second'])).toEqual(parts({ second: 90 }))
    expect(secondsToDuration(-100, ['second'])).toEqual(parts({ second: 0 }))
  })
})

describe('fitsUnits', () => {
  it('is true when nothing is lost', () => {
    expect(fitsUnits(5400, ['hour', 'minute'])).toBe(true)
    expect(fitsUnits(0, ['minute'])).toBe(true)
  })

  it('is false when the smallest shown unit is too coarse', () => {
    expect(fitsUnits(90, ['hour', 'minute'])).toBe(false)
    expect(fitsUnits(30, ['minute'])).toBe(false)
  })
})

describe('normalise', () => {
  it('carries overflow into the next shown unit', () => {
    expect(normalise(parts({ hour: 0, minute: 90 }), ['hour', 'minute'])).toEqual(
      parts({ hour: 1, minute: 30 }),
    )
  })

  it('carries all the way up a three-unit chain', () => {
    expect(normalise(parts({ day: 0, hour: 0, minute: 1500 }), ['day', 'hour', 'minute'])).toEqual(
      parts({ day: 1, hour: 1, minute: 0 }),
    )
  })

  it('carries into a unit that is still empty, treating it as zero', () => {
    expect(normalise(parts({ minute: 90 }), ['hour', 'minute'])).toEqual(
      parts({ hour: 1, minute: 30 }),
    )
  })

  it('leaves the leading unit alone — it has nothing to carry into', () => {
    expect(normalise(parts({ minute: 90 }), ['minute'])).toEqual(parts({ minute: 90 }))
    expect(normalise(parts({ hour: 100, minute: 0 }), ['hour', 'minute'])).toEqual(
      parts({ hour: 100, minute: 0 }),
    )
  })

  it('leaves an untouched field untouched', () => {
    expect(normalise(EMPTY_PARTS, ['hour', 'minute'])).toBe(EMPTY_PARTS)
  })

  it('leaves a duration that already fits alone', () => {
    const fitting = parts({ hour: 1, minute: 30 })
    expect(normalise(fitting, ['hour', 'minute'])).toEqual(fitting)
  })

  it('does not invent a unit the field does not show', () => {
    // 90 minutes in a minutes-and-seconds field stays 90 minutes; there is no
    // hours segment to carry into, so nothing may appear in one.
    expect(normalise(parts({ minute: 90, second: 0 }), ['minute', 'second'])).toEqual(
      parts({ minute: 90, second: 0 }),
    )
  })

  it('preserves the duration it is carrying', () => {
    const before = parts({ hour: 0, minute: 190 })
    const after = normalise(before, ['hour', 'minute'])
    expect(durationToSeconds(after)).toBe(durationToSeconds(before))
  })
})

describe('compareDurations', () => {
  /**
   * The reason this function exists. The date and time fields compare with `<`
   * because their formats are fixed-width and big-endian; an ISO duration is
   * neither, and the naive comparison is confidently wrong.
   */
  it('orders durations a string comparison gets backwards', () => {
    expect('PT10M' < 'PT2H').toBe(true)
    expect(compareDurations('PT10M', 'PT2H')).toBe(-1)
    expect(compareDurations('PT2H', 'PT10M')).toBe(1)
  })

  it('treats equal durations written differently as equal', () => {
    expect(compareDurations('PT90M', 'PT1H30M')).toBe(0)
    expect(compareDurations('P1D', 'PT24H')).toBe(0)
  })

  it('sorts a list correctly', () => {
    const sorted = ['PT2H', 'PT10M', 'P1D', 'PT90S'].sort(compareDurations)
    expect(sorted).toEqual(['PT90S', 'PT10M', 'PT2H', 'P1D'])
  })

  it('treats an unparseable operand as equal rather than throwing', () => {
    expect(compareDurations('garbage', 'PT1H')).toBe(0)
    expect(compareDurations('PT1H', 'P1M')).toBe(0)
  })
})

describe('withinDurationRange', () => {
  it('is inclusive at both ends', () => {
    expect(withinDurationRange('PT15M', 'PT15M', 'PT2H')).toBe(true)
    expect(withinDurationRange('PT2H', 'PT15M', 'PT2H')).toBe(true)
  })

  it('rejects outside the range', () => {
    expect(withinDurationRange('PT14M', 'PT15M', 'PT2H')).toBe(false)
    expect(withinDurationRange('PT2H1S', 'PT15M', 'PT2H')).toBe(false)
  })

  it('compares through seconds, not as strings', () => {
    // A string comparison would put PT10M above PT2H and reject this.
    expect(withinDurationRange('PT10M', undefined, 'PT2H')).toBe(true)
  })

  it('ignores a bound it cannot read', () => {
    expect(withinDurationRange('PT1H', 'garbage', 'nonsense')).toBe(true)
  })

  it('accepts a value it cannot read rather than marking it invalid', () => {
    expect(withinDurationRange('garbage', 'PT1H', 'PT2H')).toBe(true)
  })
})

describe('unitRange', () => {
  it('leaves the leading unit unbounded', () => {
    expect(unitRange('minute', ['minute'])).toEqual({ min: 0, max: Infinity })
    expect(unitRange('hour', ['hour', 'minute'])).toEqual({ min: 0, max: Infinity })
    expect(unitRange('day', ['day', 'hour'])).toEqual({ min: 0, max: Infinity })
  })

  it('bounds every unit below the leading one', () => {
    expect(unitRange('minute', ['hour', 'minute'])).toEqual({ min: 0, max: 59 })
    expect(unitRange('second', ['minute', 'second'])).toEqual({ min: 0, max: 59 })
    expect(unitRange('hour', ['day', 'hour'])).toEqual({ min: 0, max: 23 })
  })
})

describe('the small helpers', () => {
  it('pads to a width without ever truncating', () => {
    expect(pad(5, 2)).toBe('05')
    expect(pad(123, 2)).toBe('123')
    expect(pad(0, 2)).toBe('00')
  })

  /**
   * Three digits only where there is nothing to advance to. In a two-unit
   * field a third digit would have to start a new number in the same box, so
   * `180` would end as `0`.
   */
  it('gives a lone segment room for three digits and everything else two', () => {
    expect(unitWidth('minute', ['minute'])).toBe(3)
    expect(unitWidth('hour', ['hour', 'minute'])).toBe(2)
    expect(unitWidth('minute', ['hour', 'minute'])).toBe(2)
  })

  it('leaves the unit range narrower than what typing may reach', () => {
    // 90 is not a legal minute component and is exactly what someone types on
    // the way to an hour and a half, so the range cannot bound the keystroke.
    expect(unitRange('minute', ['hour', 'minute']).max).toBe(59)
    expect(unitWidth('minute', ['hour', 'minute'])).toBe(2)
  })

  it('clamps into a range', () => {
    expect(clamp(5, 0, 59)).toBe(5)
    expect(clamp(-1, 0, 59)).toBe(0)
    expect(clamp(60, 0, 59)).toBe(59)
    expect(clamp(1e9, 0, Infinity)).toBe(1e9)
  })

  it('knows when a field is complete and when it is empty', () => {
    expect(isComplete(parts({ hour: 1, minute: 0 }), ['hour', 'minute'])).toBe(true)
    expect(isComplete(parts({ hour: 1 }), ['hour', 'minute'])).toBe(false)
    expect(isEmpty(EMPTY_PARTS)).toBe(true)
    expect(isEmpty(parts({ minute: 0 }))).toBe(false)
  })

  it('sums parts into seconds, ignoring empty units', () => {
    expect(durationToSeconds(parts({ hour: 1, minute: 30 }))).toBe(5400)
    expect(durationToSeconds(EMPTY_PARTS)).toBe(0)
  })

  it('reads a duration into seconds, or null', () => {
    expect(toSeconds('PT1H30M')).toBe(5400)
    expect(toSeconds('P1M')).toBeNull()
  })

  it('agrees with itself about unit sizes', () => {
    expect(UNIT_ORDER).toEqual(['day', 'hour', 'minute', 'second'])
    expect(UNIT_SECONDS.day).toBe(24 * UNIT_SECONDS.hour)
    expect(UNIT_SECONDS.hour).toBe(60 * UNIT_SECONDS.minute)
    expect(UNIT_SECONDS.minute).toBe(60 * UNIT_SECONDS.second)
  })
})

describe('fromISODuration', () => {
  it('reads a duration into the units a field shows', () => {
    expect(fromISODuration('PT1H30M', ['hour', 'minute'])).toEqual(parts({ hour: 1, minute: 30 }))
  })

  it('folds a duration into fewer units than it was written with', () => {
    expect(fromISODuration('PT1H30M', ['minute'])).toEqual(parts({ minute: 90 }))
  })

  it('returns null for anything it cannot read', () => {
    expect(fromISODuration('P1M', ['minute'])).toBeNull()
    expect(fromISODuration('', ['minute'])).toBeNull()
  })
})
