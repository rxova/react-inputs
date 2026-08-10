import { describe, expect, it } from 'vitest'
import { GAP, durationPieces, unitName, unitSuffix, usableUnits } from '../segments'
import type { DurationUnit } from '../duration'
import { DEFAULT_UNITS } from '../useDurationInput'

describe('unitSuffix', () => {
  it('reads the locale rather than a bundled table', () => {
    expect(unitSuffix('minute', 'en-GB')).toBe('m')
    expect(unitSuffix('minute', 'de-DE')).toBe('Min.')
    expect(unitSuffix('day', 'fr-FR')).toBe('j')
  })

  it('never returns a suffix containing digits', () => {
    // The number is stripped; only what surrounds it survives. A digit leaking
    // through would paint "2h" beside a spinbutton already showing 2.
    for (const locale of ['en-US', 'de-DE', 'ja-JP', 'ar-EG', 'ru-RU']) {
      for (const unit of ['day', 'hour', 'minute', 'second'] as DurationUnit[]) {
        expect(unitSuffix(unit, locale)).not.toMatch(/\d/)
      }
    }
  })

  it('falls back rather than throwing on a locale tag Intl refuses', () => {
    expect(unitSuffix('hour', 'en_US')).toBe('h')
    expect(unitSuffix('minute', 'not a tag')).toBe('m')
  })

  it('never returns an empty string', () => {
    for (const unit of ['day', 'hour', 'minute', 'second'] as DurationUnit[]) {
      expect(unitSuffix(unit, 'en-US').length).toBeGreaterThan(0)
    }
  })
})

describe('unitName', () => {
  it('gives the locale word, not the abbreviation', () => {
    expect(unitName('hour', 'en-GB')).toBe('hours')
    expect(unitName('minute', 'de-DE')).toBe('Minuten')
  })

  /**
   * Arabic has a dual: formatted against 2, `hour` comes back as "ساعتان",
   * which means *two hours* specifically. A segment named after a quantity it
   * does not hold is worse than the plural, so the name is taken from 3.
   */
  it('avoids the dual in locales that have one', () => {
    expect(unitName('hour', 'ar-EG')).not.toBe('ساعتان')
  })

  it('returns null on a locale tag Intl refuses, so the caller can fall back', () => {
    expect(unitName('hour', 'en_US')).toBeNull()
  })
})

describe('usableUnits', () => {
  it('passes a well-formed array through', () => {
    expect(usableUnits(['hour', 'minute'], DEFAULT_UNITS)).toEqual(['hour', 'minute'])
  })

  it('falls back when the prop is absent', () => {
    expect(usableUnits(undefined, DEFAULT_UNITS)).toEqual(['hour', 'minute'])
  })

  /**
   * Order is imposed, not respected. `['minute', 'hour']` would otherwise put a
   * 0–59 segment in front of an unbounded one — a field where 90 is refused in
   * the first box and accepted in the second.
   */
  it('sorts largest-unit-first regardless of how it was written', () => {
    expect(usableUnits(['minute', 'hour'], DEFAULT_UNITS)).toEqual(['hour', 'minute'])
    expect(usableUnits(['second', 'day', 'minute', 'hour'], DEFAULT_UNITS)).toEqual([
      'day',
      'hour',
      'minute',
      'second',
    ])
  })

  it('dedupes', () => {
    expect(usableUnits(['minute', 'minute', 'hour'], DEFAULT_UNITS)).toEqual(['hour', 'minute'])
  })

  it('drops units it does not know', () => {
    expect(
      usableUnits(['hour', 'fortnight', 'month'] as unknown as DurationUnit[], DEFAULT_UNITS),
    ).toEqual(['hour'])
  })

  it('falls back rather than rendering a field with nothing to type into', () => {
    expect(usableUnits([], DEFAULT_UNITS)).toEqual(['hour', 'minute'])
    expect(usableUnits(['month'] as unknown as DurationUnit[], DEFAULT_UNITS)).toEqual([
      'hour',
      'minute',
    ])
  })

  it('copies the fallback rather than handing back the same array', () => {
    const fallback: DurationUnit[] = ['hour', 'minute']
    expect(usableUnits(undefined, fallback)).not.toBe(fallback)
  })
})

describe('durationPieces', () => {
  it('lays out each unit followed by its suffix', () => {
    const pieces = durationPieces(['hour', 'minute'], 'en-GB')
    expect(pieces.map((piece) => (piece.kind === 'segment' ? piece.type : piece.text))).toEqual([
      'hour',
      'h',
      GAP,
      'minute',
      'm',
    ])
  })

  it('puts no trailing gap after the last unit', () => {
    const pieces = durationPieces(['minute'], 'en-GB')
    expect(pieces).toHaveLength(2)
    expect(pieces.at(-1)).toEqual({ kind: 'literal', text: 'm' })
  })

  it('renders every unit it is given, in the order given', () => {
    const pieces = durationPieces(['day', 'hour', 'minute', 'second'], 'en-GB')
    expect(pieces.flatMap((piece) => (piece.kind === 'segment' ? [piece.type] : []))).toEqual([
      'day',
      'hour',
      'minute',
      'second',
    ])
  })
})
