import { describe, expect, it } from 'vitest'
import { zoneLabel, zoneOffsetLabel, zoneOptionLabel, zonePhase } from '../labels'
import { UTC, ZONES, zoneCity } from '../zones'

describe('zone names', () => {
  it('takes the locale name from Intl', () => {
    expect(zoneLabel('Europe/Madrid', 'en')).toBe('Central European Time')
    expect(zoneLabel('Asia/Kathmandu', 'en')).toBe('Nepal Time')
  })

  it('translates', () => {
    expect(zoneLabel('Europe/Madrid', 'fr')).toContain('Europe centrale')
    expect(zoneLabel('Europe/Madrid', 'fr')).not.toBe(zoneLabel('Europe/Madrid', 'en'))
  })

  /**
   * The whole reason `longGeneric` is used rather than `long`. `long` names the
   * *current phase*, so an option list built on it would relabel itself twice a
   * year — every American zone would read "Daylight" all summer and "Standard"
   * all winter, for a value that never changed.
   */
  it('names the zone, not the season', () => {
    const jan = new Date(Date.UTC(2026, 0, 15))
    const jul = new Date(Date.UTC(2026, 6, 15))
    expect(zoneLabel('America/New_York', 'en', jan)).toBe(zoneLabel('America/New_York', 'en', jul))
    expect(zoneLabel('America/New_York', 'en', jan)).toBe('Eastern Time')

    // The seasonal name is still available, deliberately separately.
    expect(zonePhase('America/New_York', 'en', jan)).toBe('Eastern Standard Time')
    expect(zonePhase('America/New_York', 'en', jul)).toBe('Eastern Daylight Time')
  })

  /**
   * ICU answers `GMT+00:00` for a zone it has no name for, which is the offset
   * again rather than a name — and it made UTC render as `UTC — GMT+00:00`.
   */
  it('falls back to the city when ICU offers an offset instead of a name', () => {
    expect(zoneLabel(UTC, 'en')).toBe(UTC)
    expect(zoneOptionLabel(UTC, 'en')).toBe('UTC (+00:00)')
  })

  it('falls back to the runtime locale rather than throwing on a bad tag', () => {
    // `en_US` with an underscore is the classic mistake.
    expect(() => zoneLabel('Europe/Madrid', 'en_US')).not.toThrow()
    expect(zoneLabel('Europe/Madrid', 'en_US')).not.toBe('')
    expect(() => zonePhase('Europe/Madrid', 'en_US')).not.toThrow()
  })

  /**
   * Forced, because it is not reachable on a working engine: both the requested
   * locale and the runtime fallback have to fail. Simulating it is the only way
   * to prove the field degrades to the city rather than throwing out of render.
   */
  it('falls back to the city on an engine with no zone formatting at all', () => {
    const real = Intl.DateTimeFormat
    const Broken = function Broken(): never {
      throw new RangeError('no zone formatting here')
    }
    try {
      // @ts-expect-error — deliberately replacing the global for one assertion.
      Intl.DateTimeFormat = Broken
      expect(zoneLabel('Europe/Madrid', 'en')).toBe('Madrid')
      expect(zonePhase('Europe/Madrid', 'en')).toBeNull()
    } finally {
      Intl.DateTimeFormat = real
    }
  })

  it('falls back to the city on an invalid instant rather than throwing', () => {
    expect(zoneLabel('Europe/Madrid', 'en', new Date(Number.NaN))).toBe('Madrid')
    expect(zonePhase('Europe/Madrid', 'en', new Date(Number.NaN))).toBeNull()
  })
})

describe('offset labels', () => {
  it('writes the offset at the given instant', () => {
    expect(zoneOffsetLabel('America/New_York', new Date(Date.UTC(2026, 0, 15)))).toBe('-05:00')
    expect(zoneOffsetLabel('America/New_York', new Date(Date.UTC(2026, 6, 15)))).toBe('-04:00')
    expect(zoneOffsetLabel('Asia/Kathmandu')).toBe('+05:45')
  })

  it('is null when the zone is not usable', () => {
    expect(zoneOffsetLabel('Mars/Olympus')).toBeNull()
  })

  it('drops the offset from an option label when there is none to show', () => {
    // Not reachable from the component, which never offers an unusable zone —
    // but `zoneOptionLabel` is exported, so it has to hold up on its own.
    expect(zoneOptionLabel('Mars/Olympus', 'en')).toBe('Olympus')
  })
})

describe('option labels', () => {
  /**
   * The city leads because a native `<select>`'s type-ahead matches from the
   * start of the option text. With 419 options sorted by offset, type-ahead is
   * the only fast way to reach a zone — an offset-first label would make
   * pressing `m` for Madrid do nothing at all.
   */
  it('leads with the city, so type-ahead reaches it', () => {
    expect(zoneOptionLabel('Europe/Madrid', 'en')).toMatch(/^Madrid/)
    expect(zoneOptionLabel('Asia/Kathmandu', 'en')).toMatch(/^Kathmandu/)
    expect(zoneOptionLabel('America/Argentina/Buenos_Aires', 'en')).toMatch(/^Buenos Aires/)
  })

  it('carries the name and the offset after it', () => {
    expect(zoneOptionLabel('Europe/Madrid', 'en')).toBe(
      `Madrid — Central European Time (${String(zoneOffsetLabel('Europe/Madrid'))})`,
    )
  })

  it('gives every zone on offer a non-empty label starting with its city', () => {
    for (const zone of ZONES) {
      const text = zoneOptionLabel(zone, 'en')
      expect(text.trim()).not.toBe('')
      expect(text.startsWith(zoneCity(zone))).toBe(true)
    }
  })
})
