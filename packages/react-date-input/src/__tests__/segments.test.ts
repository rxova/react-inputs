import { describe, expect, it } from 'vitest'
import { datePieces, monthNames, segmentOrder } from '../segments'

/**
 * Segment order comes from the platform's ICU data, so these assert the
 * *relationships* the component depends on rather than exact separator
 * characters — ICU changes those between versions (the `en-US` slash became a
 * different code point in one release), and pinning them would make this suite
 * fail on a Node upgrade for no real reason.
 */
describe('segmentOrder', () => {
  it('puts the month first for en-US and the day first for en-GB', () => {
    expect(segmentOrder('en-US')).toEqual(['month', 'day', 'year'])
    expect(segmentOrder('en-GB')).toEqual(['day', 'month', 'year'])
  })

  it('puts the year first for locales that write big-endian', () => {
    expect(segmentOrder('ja-JP')).toEqual(['year', 'month', 'day'])
    expect(segmentOrder('sv-SE')).toEqual(['year', 'month', 'day'])
  })

  it('always yields exactly the three segments, whatever the locale', () => {
    for (const locale of ['en-US', 'en-GB', 'de-DE', 'fr-FR', 'ja-JP', 'ar-EG', 'hu-HU']) {
      const order = segmentOrder(locale)
      expect(order).toHaveLength(3)
      expect(new Set(order)).toEqual(new Set(['day', 'month', 'year']))
    }
  })

  it('falls back to ISO order for a malformed locale tag instead of throwing', () => {
    // `Intl` throws RangeError on "en_US". A date field that crashes because of
    // an underscore is a worse outcome than one that quietly uses ISO order.
    expect(segmentOrder('en_US')).toEqual(['year', 'month', 'day'])
    expect(segmentOrder('not a locale')).toEqual(['year', 'month', 'day'])
  })
})

describe('datePieces', () => {
  it('interleaves separators between the segments', () => {
    const pieces = datePieces('en-GB')
    expect(pieces.map((piece) => piece.kind)).toEqual([
      'segment',
      'literal',
      'segment',
      'literal',
      'segment',
    ])
  })

  it('never starts or ends with a separator', () => {
    // `ja-JP` formats as 3333年11月22日 — a trailing suffix that reads as a
    // dangling character after the last editable segment.
    for (const locale of ['en-US', 'ja-JP', 'ko-KR', 'zh-CN', 'de-DE']) {
      const pieces = datePieces(locale)
      expect(pieces.at(0)?.kind).toBe('segment')
      expect(pieces.at(-1)?.kind).toBe('segment')
    }
  })

  it('emits a non-empty separator between each pair', () => {
    for (const locale of ['en-US', 'en-GB', 'de-DE', 'ja-JP']) {
      for (const piece of datePieces(locale)) {
        if (piece.kind === 'literal') expect(piece.text.length).toBeGreaterThan(0)
      }
    }
  })

  it('is stable across calls', () => {
    expect(datePieces('en-US')).toEqual(datePieces('en-US'))
  })
})

describe('monthNames', () => {
  it('returns twelve localised names in calendar order', () => {
    const english = monthNames('en-US')
    expect(english).toHaveLength(12)
    expect(english[0]).toBe('January')
    expect(english[11]).toBe('December')
  })

  it('localises', () => {
    expect(monthNames('fr-FR')[0]?.toLowerCase()).toBe('janvier')
    expect(monthNames('de-DE')[11]).toBe('Dezember')
  })

  it('falls back to English for a malformed locale tag', () => {
    expect(monthNames('en_US')[0]).toBe('January')
  })

  it('is not off by one from a timezone shift', () => {
    // Built from mid-month UTC dates precisely so no timezone can push a name
    // into the previous or next month.
    const names = monthNames('en-US')
    expect(names[1]).toBe('February')
    expect(names[2]).toBe('March')
  })
})
