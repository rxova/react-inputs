import { describe, expect, it } from 'vitest'
import { dayPeriodNames, timePieces, usesHour12 } from '../segments'

/**
 * Layout comes from the platform's ICU data, so these assert the *relationships*
 * the component depends on rather than exact separator characters — ICU changes
 * those between versions, and pinning them would fail the suite on a Node
 * upgrade for no real reason.
 */
describe('usesHour12', () => {
  it('knows which locales write on a 12-hour clock', () => {
    expect(usesHour12('en-US')).toBe(true)
    expect(usesHour12('de-DE')).toBe(false)
    expect(usesHour12('fr-FR')).toBe(false)
  })

  it('falls back to a 24-hour clock for a malformed tag instead of throwing', () => {
    // `Intl` throws RangeError on "en_US"; crashing a time field over an
    // underscore is a worse outcome than a 24-hour default.
    expect(usesHour12('en_US')).toBe(false)
    expect(usesHour12('not a locale')).toBe(false)
  })
})

describe('timePieces', () => {
  it('lays out hour and minute with a separator between them', () => {
    const pieces = timePieces('en-GB', false, false)
    expect(pieces.map((p) => p.kind)).toEqual(['segment', 'literal', 'segment'])
    expect(pieces.filter((p) => p.kind === 'segment').map((p) => p.type)).toEqual([
      'hour',
      'minute',
    ])
  })

  it('adds a seconds segment only when asked', () => {
    const withSeconds = timePieces('en-GB', true, false)
    expect(withSeconds.filter((p) => p.kind === 'segment').map((p) => p.type)).toEqual([
      'hour',
      'minute',
      'second',
    ])
  })

  it('adds a day period on a 12-hour clock, where the locale puts it', () => {
    const pieces = timePieces('en-US', false, true)
    const types = pieces.filter((p) => p.kind === 'segment').map((p) => p.type)
    expect(types).toContain('dayPeriod')
    // English puts it last.
    expect(types.at(-1)).toBe('dayPeriod')
  })

  it('omits the day period on a 24-hour clock', () => {
    const types = timePieces('en-US', false, false)
      .filter((p) => p.kind === 'segment')
      .map((p) => p.type)
    expect(types).not.toContain('dayPeriod')
  })

  it('never starts or ends with a separator', () => {
    for (const locale of ['en-US', 'de-DE', 'ja-JP', 'zh-CN', 'ko-KR']) {
      for (const hour12 of [true, false]) {
        const pieces = timePieces(locale, true, hour12)
        expect(pieces.at(0)?.kind).toBe('segment')
        expect(pieces.at(-1)?.kind).toBe('segment')
      }
    }
  })

  it('falls back to 24-hour HH:mm for a malformed locale tag', () => {
    const pieces = timePieces('en_US', false, false)
    expect(pieces.filter((p) => p.kind === 'segment').map((p) => p.type)).toEqual([
      'hour',
      'minute',
    ])
  })

  it('falls back with seconds when the field wants them', () => {
    const pieces = timePieces('en_US', true, false)
    expect(pieces.filter((p) => p.kind === 'segment').map((p) => p.type)).toEqual([
      'hour',
      'minute',
      'second',
    ])
  })

  it('is stable across calls', () => {
    expect(timePieces('en-US', false, true)).toEqual(timePieces('en-US', false, true))
  })
})

describe('dayPeriodNames', () => {
  it('returns the localised words, not hard-coded AM/PM', () => {
    // Hard-coding "AM"/"PM" is wrong in most of the world.
    expect(dayPeriodNames('en-US')).toEqual(['AM', 'PM'])
    const [amES] = dayPeriodNames('es-ES')
    expect(amES.toLowerCase()).toContain('a')
    const [amJA, pmJA] = dayPeriodNames('ja-JP')
    expect(amJA).toBe('午前')
    expect(pmJA).toBe('午後')
  })

  it('returns two distinct words', () => {
    for (const locale of ['en-US', 'es-ES', 'ja-JP', 'ko-KR', 'ar-EG']) {
      const [am, pm] = dayPeriodNames(locale)
      expect(am.length).toBeGreaterThan(0)
      expect(pm.length).toBeGreaterThan(0)
      expect(am).not.toBe(pm)
    }
  })

  it('falls back to English for a malformed locale tag', () => {
    expect(dayPeriodNames('en_US')).toEqual(['AM', 'PM'])
  })
})
