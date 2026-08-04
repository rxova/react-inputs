import { describe, expect, it } from 'vitest'
import { COUNTRIES, countryByISO2, countryForDial, countryName, flagEmoji } from '../countries'

/**
 * The table is hand-maintained data, so these assert **structural invariants**
 * rather than every value. Pinning all 234 dial codes would turn any correction
 * into a 234-line test diff and would not catch the failure that actually
 * matters — a malformed entry that makes lookups behave unpredictably.
 */
describe('the country table', () => {
  it('parses into a usable list', () => {
    expect(COUNTRIES.length).toBeGreaterThan(200)
  })

  it('has no duplicate ISO codes', () => {
    // A duplicate would make `countryByISO2` order-dependent, and the table
    // genuinely lists some territories twice (CX and CC both sit on +61).
    const codes = COUNTRIES.map((country) => country.iso2)
    expect(new Set(codes).size).toBe(codes.length)
  })

  it('has a well-formed ISO code and calling code for every entry', () => {
    for (const country of COUNTRIES) {
      expect(country.iso2).toMatch(/^[A-Z]{2}$/)
      expect(country.dial).toMatch(/^\d{1,4}$/)
    }
  })

  it('has plausible lengths and groups wherever they are given', () => {
    for (const country of COUNTRIES) {
      for (const length of country.lengths) {
        // E.164 caps the whole number at 15 digits including the calling code.
        expect(length).toBeGreaterThanOrEqual(4)
        expect(length).toBeLessThanOrEqual(15)
      }
      for (const group of country.groups) {
        expect(group).toBeGreaterThanOrEqual(1)
      }
      // A grouping that does not add up to a declared length would paint a
      // trailing fragment on every complete number.
      if (country.groups.length > 0 && country.lengths.length > 0) {
        const total = country.groups.reduce((sum, size) => sum + size, 0)
        expect(country.lengths).toContain(total)
      }
    }
  })

  it('includes the regions a phone field is most often asked about', () => {
    for (const iso2 of ['US', 'CA', 'GB', 'DE', 'FR', 'ES', 'IT', 'BR', 'IN', 'JP', 'AU', 'ZA']) {
      expect(countryByISO2(iso2)).toBeDefined()
    }
  })

  it('carries the calling codes that share a prefix', () => {
    expect(countryByISO2('US')?.dial).toBe('1')
    expect(countryByISO2('CA')?.dial).toBe('1')
    expect(countryByISO2('RU')?.dial).toBe('7')
    expect(countryByISO2('KZ')?.dial).toBe('7')
  })
})

describe('countryByISO2', () => {
  it('is case-insensitive', () => {
    expect(countryByISO2('gb')?.iso2).toBe('GB')
    expect(countryByISO2('Gb')?.iso2).toBe('GB')
  })

  it('returns undefined for anything not in the table', () => {
    expect(countryByISO2('ZZ')).toBeUndefined()
    expect(countryByISO2('')).toBeUndefined()
    expect(countryByISO2('United Kingdom')).toBeUndefined()
  })
})

describe('countryForDial', () => {
  it('resolves an unambiguous calling code', () => {
    expect(countryForDial('442071234567')?.iso2).toBe('GB')
    expect(countryForDial('34600123456')?.iso2).toBe('ES')
    expect(countryForDial('81312345678')?.iso2).toBe('JP')
  })

  it('prefers the longest matching code', () => {
    // `35` is nobody's code but `351` is Portugal's and `350` Gibraltar's, so a
    // shortest-first scan would have to guess.
    expect(countryForDial('351912345678')?.iso2).toBe('PT')
    expect(countryForDial('35020012345')?.iso2).toBe('GI')
  })

  it('resolves a shared code to the first table entry', () => {
    // +1 covers 25 entries and the calling code alone cannot distinguish them.
    // The first wins, which is what every phone field does; callers who need a
    // specific one pass `country`.
    expect(countryForDial('14155552671')?.iso2).toBe('US')
    expect(countryForDial('79161234567')?.iso2).toBe('KZ')
  })

  it('returns undefined for a code nobody uses', () => {
    expect(countryForDial('99912345')).toBeUndefined()
    expect(countryForDial('')).toBeUndefined()
  })
})

describe('flagEmoji', () => {
  it('builds a flag from the two regional-indicator letters', () => {
    // No icon font, no SVG sprite — six bytes of arithmetic.
    expect(flagEmoji('GB')).toBe('🇬🇧')
    expect(flagEmoji('JP')).toBe('🇯🇵')
    expect(flagEmoji('US')).toBe('🇺🇸')
  })

  it('is case-insensitive', () => {
    expect(flagEmoji('gb')).toBe(flagEmoji('GB'))
  })

  it('returns an empty string for anything that is not two letters', () => {
    expect(flagEmoji('')).toBe('')
    expect(flagEmoji('G')).toBe('')
    expect(flagEmoji('GBR')).toBe('')
    expect(flagEmoji('12')).toBe('')
  })

  it('produces a flag for every country in the table', () => {
    for (const country of COUNTRIES) {
      expect(flagEmoji(country.iso2)).not.toBe('')
    }
  })
})

describe('countryName', () => {
  it('takes names from the platform rather than a bundled table', () => {
    expect(countryName('DE', 'en')).toBe('Germany')
    expect(countryName('DE', 'fr')).toBe('Allemagne')
    expect(countryName('JP', 'es')).toBe('Japón')
  })

  it('always returns something usable, even for a region it does not know', () => {
    // `Intl.DisplayNames` answers "Unknown Region" for a well-formed but
    // unassigned code rather than echoing it back, so the contract here is
    // "never empty, never throws" — not a particular string.
    expect(countryName('ZZ', 'en').length).toBeGreaterThan(0)
    expect(() => countryName('ZZ', 'en')).not.toThrow()
  })

  it('falls back to the ISO code for a malformed locale tag', () => {
    // `Intl` throws RangeError on "en_US"; a country list that crashes over an
    // underscore is a worse outcome than one showing ISO codes.
    expect(countryName('DE', 'en_US')).toBe('DE')
  })

  it('names every country in the table', () => {
    for (const country of COUNTRIES) {
      expect(countryName(country.iso2, 'en').length).toBeGreaterThan(0)
    }
  })
})
