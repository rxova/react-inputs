import { describe, expect, it } from 'vitest'
import {
  caretForDigitIndex,
  digitsBeforeCaret,
  digitsOnly,
  formatNational,
  formatPhone,
  isPossible,
  lengthsFor,
  parsePhone,
  stripTrunkPrefix,
} from '../phone'
import { countryByISO2 } from '../countries'

describe('digitsOnly', () => {
  it('keeps digits and drops everything else', () => {
    expect(digitsOnly('+44 (0)20 7123-4567')).toBe('44020712345 67'.replace(' ', ''))
    expect(digitsOnly('abc')).toBe('')
    expect(digitsOnly('')).toBe('')
  })

  it('normalises non-Latin numerals', () => {
    // Users on an Arabic or Japanese keyboard type these, and a naive
    // `/\d/` filter throws the whole number away.
    expect(digitsOnly('٠١٢٣٤٥٦٧٨٩')).toBe('0123456789')
    expect(digitsOnly('۰۱۲۳')).toBe('0123')
    expect(digitsOnly('１２３４')).toBe('1234')
  })
})

describe('stripTrunkPrefix', () => {
  it('drops a single leading zero for countries that use one', () => {
    expect(stripTrunkPrefix(countryByISO2('GB'), '02071234567')).toBe('2071234567')
    expect(stripTrunkPrefix(countryByISO2('DE'), '030123456')).toBe('30123456')
  })

  it('keeps the zero for Italy, where it is part of the number', () => {
    // The well-known exception: +39 06 … is correct, not +39 6 ….
    expect(stripTrunkPrefix(countryByISO2('IT'), '0612345678')).toBe('0612345678')
  })

  it('drops only one zero, and only at the front', () => {
    expect(stripTrunkPrefix(countryByISO2('GB'), '00201234')).toBe('0201234')
    expect(stripTrunkPrefix(countryByISO2('GB'), '2001234')).toBe('2001234')
  })

  it('leaves the digits alone with no country', () => {
    expect(stripTrunkPrefix(undefined, '0123')).toBe('0123')
  })
})

describe('lengthsFor and isPossible', () => {
  it('uses the table lengths when it has them', () => {
    expect(lengthsFor(countryByISO2('US'))).toEqual({ min: 10, max: 10 })
    expect(lengthsFor(countryByISO2('IT'))).toEqual({ min: 9, max: 10 })
  })

  it('falls back to the E.164 bounds when it does not', () => {
    expect(lengthsFor(countryByISO2('AT'))).toEqual({ min: 4, max: 15 })
    expect(lengthsFor(undefined)).toEqual({ min: 4, max: 15 })
  })

  it('accepts exactly the lengths a country uses', () => {
    const us = countryByISO2('US')
    expect(isPossible(us, '4155552671')).toBe(true)
    expect(isPossible(us, '415555267')).toBe(false)
    expect(isPossible(us, '41555526711')).toBe(false)
  })

  it('accepts every declared length where a country has several', () => {
    const it = countryByISO2('IT')
    expect(isPossible(it, '061234567'.padEnd(9, '0'))).toBe(true)
    expect(isPossible(it, '0612345678')).toBe(true)
    expect(isPossible(it, '06123456')).toBe(false)
  })

  it('is never true for an empty number', () => {
    expect(isPossible(countryByISO2('US'), '')).toBe(false)
    expect(isPossible(undefined, '')).toBe(false)
  })

  it('uses the generic bounds for a country with no declared lengths', () => {
    const at = countryByISO2('AT')
    expect(isPossible(at, '1234')).toBe(true)
    expect(isPossible(at, '123')).toBe(false)
    expect(isPossible(at, '1234567890123456')).toBe(false)
  })
})

describe('parsePhone', () => {
  it('reads an explicit international number and ignores the default country', () => {
    const parsed = parsePhone('+44 20 7123 4567', 'US')
    expect(parsed.country?.iso2).toBe('GB')
    expect(parsed.national).toBe('2071234567')
    expect(parsed.e164).toBe('+442071234567')
    expect(parsed.possible).toBe(true)
  })

  it('treats 00 as the international prefix', () => {
    expect(parsePhone('0044 20 7123 4567', 'US').e164).toBe('+442071234567')
  })

  it('treats 011 as the international prefix inside the NANP', () => {
    // The NANP dials out with 011 rather than 00, and a US user pasting their
    // own dialling string should not have it read as a national number.
    expect(parsePhone('011 44 20 7123 4567', 'US').e164).toBe('+442071234567')
  })

  it('does not treat 011 as international outside the NANP', () => {
    // In the UK, 011x is a legitimate area code (0113 is Leeds).
    const parsed = parsePhone('0113 496 0000', 'GB')
    expect(parsed.country?.iso2).toBe('GB')
    expect(parsed.national).toBe('1134960000')
  })

  it('reads a national number against the selected country', () => {
    const parsed = parsePhone('020 7123 4567', 'GB')
    expect(parsed.country?.iso2).toBe('GB')
    expect(parsed.e164).toBe('+442071234567')
  })

  it('reports an unrecognised calling code as not possible', () => {
    // The `+` tells us for certain this is meant to be international, so the
    // generic 4–15 bounds must not rescue it.
    const parsed = parsePhone('+99 12345')
    expect(parsed.country).toBeUndefined()
    expect(parsed.e164).toBe('')
    expect(parsed.possible).toBe(false)
  })

  it('returns an empty value for empty input', () => {
    const parsed = parsePhone('', 'GB')
    expect(parsed.e164).toBe('')
    expect(parsed.possible).toBe(false)
  })

  it('ignores punctuation and whitespace entirely', () => {
    expect(parsePhone('+1 (415) 555-2671').e164).toBe('+14155552671')
    expect(parsePhone('  +1.415.555.2671  ').e164).toBe('+14155552671')
  })

  it('resolves a shared calling code to the first table entry', () => {
    expect(parsePhone('+1 416 555 2671').country?.iso2).toBe('US')
  })
})

describe('formatNational', () => {
  it('applies the groups it is given', () => {
    expect(formatNational('4155552671', [3, 3, 4])).toBe('415 555 2671')
    expect(formatNational('2071234567', [4, 6])).toBe('2071 234567')
  })

  it('formats a partial number without waiting for the rest', () => {
    expect(formatNational('415', [3, 3, 4])).toBe('415')
    expect(formatNational('41555', [3, 3, 4])).toBe('415 55')
  })

  it('falls back to threes past the last known group', () => {
    // An over-long number still reads as digits rather than a wall.
    expect(formatNational('41555526719999', [3, 3, 4])).toBe('415 555 2671 999 9')
  })

  it('uses threes throughout when no grouping is known', () => {
    expect(formatNational('123456789', [])).toBe('123 456 789')
  })

  it('returns an empty string for no digits', () => {
    expect(formatNational('', [3, 3])).toBe('')
  })
})

describe('formatPhone', () => {
  it('shows the calling code in international mode', () => {
    expect(formatPhone(parsePhone('+14155552671'), true)).toBe('+1 415 555 2671')
  })

  it('omits it in national mode, where the select carries the country', () => {
    expect(formatPhone(parsePhone('4155552671', 'US'), false)).toBe('415 555 2671')
  })

  it('shows a lone plus and calling code while the number is still empty', () => {
    // Deleting back to `+44` must not make the calling code vanish, or there is
    // no way to correct it.
    expect(formatPhone(parsePhone('+44'), true)).toBe('+44')
  })

  it('keeps unrecognised digits visible rather than discarding them', () => {
    expect(formatPhone(parsePhone('+999'), true)).toBe('+999')
  })

  it('formats a bare plus as a plus, not as nothing', () => {
    // The first keystroke of every international number. Returning '' here
    // erased the plus the instant it was typed, so the digits that followed
    // were read as a national number and the country could never change.
    expect(formatPhone(parsePhone('+'), true)).toBe('+')
  })
})

describe('caret bookkeeping', () => {
  it('counts the digits before a caret position', () => {
    expect(digitsBeforeCaret('+1 415 555 2671', 0)).toBe(0)
    expect(digitsBeforeCaret('+1 415 555 2671', 2)).toBe(1)
    expect(digitsBeforeCaret('+1 415 555 2671', 6)).toBe(4)
  })

  it('places the caret after the nth digit of the formatted text', () => {
    // The anchor that survives reformatting: character offsets shift when a
    // separator is inserted, digit counts do not.
    expect(caretForDigitIndex('+1 415 555 2671', 1)).toBe(2)
    expect(caretForDigitIndex('+1 415 555 2671', 4)).toBe(6)
    expect(caretForDigitIndex('415 555 2671', 3)).toBe(3)
  })

  it('puts the caret after a leading plus when no digits precede it', () => {
    expect(caretForDigitIndex('+44 20', 0)).toBe(1)
    expect(caretForDigitIndex('415', 0)).toBe(0)
  })

  it('clamps past the end when asked for more digits than exist', () => {
    expect(caretForDigitIndex('415', 99)).toBe(3)
  })

  it('round-trips a caret through a reformat', () => {
    const before = '+1 415 5552671'
    const caret = 8
    const digits = digitsBeforeCaret(before, caret)
    const after = formatPhone(parsePhone(before), true)
    const restored = caretForDigitIndex(after, digits)
    // Whatever the reformat did, the same number of digits sits to the left.
    expect(digitsBeforeCaret(after, restored)).toBe(digits)
  })
})
