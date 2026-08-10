import { describe, expect, it } from 'vitest'
import {
  UTC,
  ZONES,
  compareZones,
  formatOffset,
  sortZones,
  groupByArea,
  isOffsetZone,
  isUsableZone,
  localZone,
  resolveZone,
  zoneArea,
  zoneCity,
  zoneOffsetMinutes,
} from '../zones'

/**
 * These assertions are written to survive an ICU update, because the whole
 * package rests on data the engine owns. Where a specific spelling would be
 * brittle — `Europe/Kiev` today, `Europe/Kyiv` on a newer build — the test
 * asserts the *property* instead: that both spellings land on something the
 * field lists.
 */

describe('the zone list', () => {
  /**
   * Problem 1, asserted from both sides. If a future ICU adds `UTC` to the
   * platform list, the first expectation flips and this test should be updated
   * to match — but the second must hold either way.
   */
  it('adds UTC, which the platform does not list', () => {
    let supported: string[] = []
    expect(() => {
      supported = [...Intl.supportedValuesOf('timeZone')]
    }).not.toThrow()

    expect(supported).not.toContain(UTC)
    // And nothing in it stands in for UTC either.
    const standIn = supported.filter(
      (zone) =>
        new Intl.DateTimeFormat('en', { timeZone: zone }).resolvedOptions().timeZone === UTC,
    )
    expect(standIn).toEqual([])

    // So the field has to put it there.
    expect(ZONES).toContain(UTC)
    expect(ZONES[0]).toBe(UTC)
  })

  it('offers every zone the platform knows, exactly once', () => {
    const supported = [...Intl.supportedValuesOf('timeZone')]
    expect(ZONES.length).toBe(supported.length + 1)
    expect(new Set(ZONES).size).toBe(ZONES.length)
    for (const zone of supported) expect(ZONES).toContain(zone)
  })

  it('gives every zone a usable offset', () => {
    for (const zone of ZONES) {
      const minutes = zoneOffsetMinutes(zone)
      expect(minutes).not.toBeNull()
      expect(Number.isFinite(minutes)).toBe(true)
    }
  })

  it('sorts by offset, then by name, with UTC pinned in front', () => {
    // UTC is deliberately ahead of the offset order rather than inside it, so
    // the sortedness claim is about the rest of the list.
    expect(ZONES[0]).toBe(UTC)
    for (let index = 2; index < ZONES.length; index++) {
      const previous = ZONES[index - 1]!
      const current = ZONES[index]!
      expect(compareZones(previous, current)).toBeLessThanOrEqual(0)
    }
  })
})

describe('usability', () => {
  it('accepts a real zone and refuses everything else', () => {
    expect(isUsableZone('Europe/Madrid')).toBe(true)
    expect(isUsableZone(UTC)).toBe(true)
    for (const value of ['Mars/Olympus', 'not a zone', '', 'GMT+2', null, 5, {}, undefined]) {
      expect(isUsableZone(value)).toBe(false)
    }
  })

  /**
   * A genuine surprise, and the reason `isOffsetZone` exists: ECMA-402 accepts
   * *offset* time zones, so `Intl` is perfectly happy with `+02:00`. It is still
   * the one thing this field must not store — an offset cannot express a
   * daylight-saving change — so the platform's answer and the field's answer
   * deliberately differ here.
   */
  it('separates what the platform accepts from what this field will keep', () => {
    for (const offset of ['+02:00', '-05:00', '+0200', '+02']) {
      expect(isUsableZone(offset)).toBe(true)
      expect(isOffsetZone(offset)).toBe(true)
      expect(resolveZone(offset)).toBeNull()
    }
    expect(isOffsetZone('Europe/Madrid')).toBe(false)
    expect(isOffsetZone(UTC)).toBe(false)
    expect(isOffsetZone('Mars/Olympus')).toBe(false)
    expect(isOffsetZone(null)).toBe(false)
  })

  /**
   * Forced for the same reason: an engine whose `resolvedOptions()` throws is
   * pre-2017, and UTC is the one answer that is never wrong there.
   */
  it('falls back to UTC when the engine cannot report a zone', () => {
    const real = Intl.DateTimeFormat
    const Broken = function Broken(): never {
      throw new RangeError('no resolvedOptions here')
    }
    try {
      // @ts-expect-error — deliberately replacing the global for one assertion.
      Intl.DateTimeFormat = Broken
      expect(localZone()).toBe(UTC)
    } finally {
      Intl.DateTimeFormat = real
    }
  })

  it('reports the runtime zone, and it is one the platform accepts', () => {
    const zone = localZone()
    expect(typeof zone).toBe('string')
    expect(isUsableZone(zone)).toBe(true)
  })
})

describe('offsets', () => {
  it('handles the offsets that are not whole hours', () => {
    // Minutes rather than hours is not pedantry: these are real places.
    expect(zoneOffsetMinutes('Asia/Kathmandu')).toBe(345)
    expect(zoneOffsetMinutes('Asia/Kolkata') ?? zoneOffsetMinutes('Asia/Calcutta')).toBe(330)
    expect(zoneOffsetMinutes('Pacific/Chatham', new Date(Date.UTC(2026, 0, 15)))).toBe(825)
    expect(zoneOffsetMinutes(UTC)).toBe(0)
  })

  /**
   * The reason the incumbent's two dependencies exist, and the reason this
   * package needs none: DST comes from the engine, live.
   */
  it('follows DST rather than freezing an offset', () => {
    const jan = new Date(Date.UTC(2026, 0, 15))
    const jul = new Date(Date.UTC(2026, 6, 15))
    expect(zoneOffsetMinutes('America/New_York', jan)).toBe(-300)
    expect(zoneOffsetMinutes('America/New_York', jul)).toBe(-240)
    // And the southern hemisphere runs the other way.
    expect(zoneOffsetMinutes('Australia/Sydney', jan)).toBe(660)
    expect(zoneOffsetMinutes('Australia/Sydney', jul)).toBe(600)
  })

  /**
   * `Etc/GMT+5` is UTC−5. Nothing special-cases it: the offset is read back out
   * of `Intl` rather than parsed from the id, so the POSIX sign inversion simply
   * never arises. A wrapper that split the id on `+` would get it backwards.
   */
  it('reads Etc/GMT signs from the engine rather than from the id', () => {
    expect(zoneOffsetMinutes('Etc/GMT+5')).toBe(-300)
    expect(zoneOffsetMinutes('Etc/GMT-5')).toBe(300)
    // None of them are on offer, so this only matters for a supplied value.
    expect(ZONES.filter((zone) => zone.startsWith('Etc/'))).toEqual([])
  })

  it('is null for a zone or an instant it cannot use', () => {
    expect(zoneOffsetMinutes('Mars/Olympus')).toBeNull()
    expect(zoneOffsetMinutes(UTC, new Date(Number.NaN))).toBeNull()
  })

  it('orders a zone it cannot read, and ties, without throwing', () => {
    // The defensive halves: an unusable zone counts as offset zero, and two
    // equal ids tie rather than producing an unstable sort.
    expect(compareZones('UTC', 'UTC')).toBe(0)
    // An unreadable zone counts as offset zero, so it falls through to the
    // name tiebreak rather than throwing or sorting unpredictably.
    expect(compareZones('Mars/Olympus', 'UTC')).toBeLessThan(0)
    expect(compareZones('Mars/Olympus', 'Asia/Tokyo')).toBeLessThan(0)
  })

  it('sorts a list that does not contain UTC without inventing it', () => {
    const sorted = sortZones(['Asia/Tokyo', 'Europe/Madrid'])
    expect(sorted).not.toContain(UTC)
    expect(sorted).toHaveLength(2)
  })

  it('writes an offset the way ISO 8601 writes it', () => {
    expect(formatOffset(345)).toBe('+05:45')
    expect(formatOffset(-300)).toBe('-05:00')
    expect(formatOffset(0)).toBe('+00:00')
    expect(formatOffset(-45)).toBe('-00:45')
    expect(formatOffset(825)).toBe('+13:45')
  })
})

/**
 * Problem 2. The engine's spelling is not your database's spelling, and which
 * one is which depends on the ICU build — so every assertion here is about the
 * *property* rather than about a particular name.
 */
describe('resolving a zone onto this engine spelling', () => {
  it('lands a renamed zone on something the field lists, whichever way round', () => {
    for (const [modern, legacy] of [
      ['Asia/Kolkata', 'Asia/Calcutta'],
      ['Europe/Kyiv', 'Europe/Kiev'],
      ['Atlantic/Faroe', 'Atlantic/Faeroe'],
      ['Asia/Ho_Chi_Minh', 'Asia/Saigon'],
    ] as const) {
      for (const spelling of [modern, legacy]) {
        const resolved = resolveZone(spelling)
        expect(resolved).not.toBeNull()
        expect(ZONES).toContain(resolved)
      }
      // Both spellings agree on one entry — that is what makes the picker work.
      expect(resolveZone(modern)).toBe(resolveZone(legacy))
    }
  })

  it('expands the legacy shorthands', () => {
    expect(resolveZone('US/Eastern')).toBe('America/New_York')
    expect(resolveZone('Japan')).toBe('Asia/Tokyo')
    expect(resolveZone('GMT')).toBe(UTC)
  })

  it('leaves an already-canonical zone alone', () => {
    expect(resolveZone('Europe/Madrid')).toBe('Europe/Madrid')
    expect(resolveZone(UTC)).toBe(UTC)
  })

  it('is null for anything the platform cannot use', () => {
    for (const value of ['Mars/Olympus', '+02:00', '', null, 5, undefined]) {
      expect(resolveZone(value)).toBeNull()
    }
  })

  /**
   * The heuristic this replaced, kept as a test so it cannot come back: matching
   * zones by their offset history is far too coarse. Several genuinely distinct
   * places share Kyiv's exact offsets, so a behavioural match would have had a
   * one-in-five chance of storing Riga for a user who meant Kyiv.
   */
  it('does not fall back to matching zones by their offset history', () => {
    const probes = [
      new Date(Date.UTC(1980, 0, 15)),
      new Date(Date.UTC(2026, 0, 15)),
      new Date(Date.UTC(2026, 6, 15)),
    ]
    const kyiv = resolveZone('Europe/Kyiv')
    expect(kyiv).not.toBeNull()
    const signature = (zone: string) => probes.map((at) => zoneOffsetMinutes(zone, at)).join('|')
    const lookalikes = ZONES.filter((zone) => signature(zone) === signature(kyiv ?? UTC))
    expect(lookalikes.length).toBeGreaterThan(1)
    // And the one we resolve to is the one that was asked for, not the first
    // alphabetically among those.
    expect(lookalikes[0]).not.toBe(kyiv)
  })
})

describe('ids', () => {
  it('splits an id into an area and a city', () => {
    expect(zoneArea('Europe/Madrid')).toBe('Europe')
    expect(zoneCity('Europe/Madrid')).toBe('Madrid')
    expect(zoneArea(UTC)).toBe(UTC)
    expect(zoneCity(UTC)).toBe(UTC)
  })

  it('takes the last segment of a three-part id, and drops the underscores', () => {
    expect(zoneCity('America/Argentina/Buenos_Aires')).toBe('Buenos Aires')
    expect(zoneArea('America/Argentina/Buenos_Aires')).toBe('America')
    expect(zoneCity('America/North_Dakota/New_Salem')).toBe('New Salem')
  })

  it('groups without losing or duplicating a zone', () => {
    const groups = groupByArea(ZONES)
    expect(groups[0]?.area).toBe(UTC)
    // Set equality, not order: the flat list is sorted by offset, so one area's
    // zones are not contiguous in it and grouping necessarily reorders them.
    const regrouped = groups.flatMap((group) => group.zones)
    expect(regrouped).toHaveLength(ZONES.length)
    expect(new Set(regrouped)).toEqual(new Set(ZONES))
    expect(new Set(groups.map((group) => group.area)).size).toBe(groups.length)
  })

  it('keeps each area internally in the order it was given', () => {
    const europe = groupByArea(ZONES).find((group) => group.area === 'Europe')
    expect(europe).toBeDefined()
    expect(europe?.zones).toEqual(ZONES.filter((zone) => zoneArea(zone) === 'Europe'))
  })

  it('groups an empty list into nothing', () => {
    expect(groupByArea([])).toEqual([])
  })
})
