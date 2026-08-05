import {
  MAX_NATIONAL_DIGITS,
  MIN_NATIONAL_DIGITS,
  countryByISO2,
  countryForDial,
} from './countries'
import type { Country } from './countries'

/**
 * Parsing, formatting and possibility checks.
 *
 * The honest framing up front: this does **possibility**, not **validity**.
 * `libphonenumber` can tell you that `+1 555 555 5555` is not an assignable
 * US number because it carries the assignment rules for every carrier block in
 * the world — that is what its metadata buys, and why a field built on it is
 * ~41 kB brotli. This tells you the digits are the right length for the country,
 * which is what a form field actually needs to stop a typo, and the whole
 * component is 3.9 kB. The README says so in the same words; the prop is
 * `possible`, never `valid`.
 *
 * Everything here is pure and synchronous.
 */

/** The result of interpreting whatever is in the field. */
export interface ParsedPhone {
  /** The country the number resolves to, if one can be determined. */
  country: Country | undefined
  /** National significant digits — no calling code, no trunk prefix. */
  national: string
  /** `+` followed by calling code and national digits, or `''` when incomplete. */
  e164: string
  /** The national part is a length this country actually uses. */
  possible: boolean
}

/** Keep only the digits. Handles Arabic-Indic and full-width numerals too. */
export function digitsOnly(input: string): string {
  let out = ''
  for (const char of input) {
    // `?? 0` is unreachable: `char` comes from iterating a string, so it is
    // never empty. Excluded rather than "covered" by a test that cannot exist.
    /* v8 ignore next */
    const code = char.codePointAt(0) ?? 0
    // ASCII 0-9.
    if (code >= 48 && code <= 57) out += char
    // Arabic-Indic 0660-0669, Extended Arabic-Indic 06F0-06F9, full-width FF10-FF19.
    else if (code >= 0x0660 && code <= 0x0669) out += String(code - 0x0660)
    else if (code >= 0x06f0 && code <= 0x06f9) out += String(code - 0x06f0)
    else if (code >= 0xff10 && code <= 0xff19) out += String(code - 0xff10)
  }
  return out
}

/**
 * Countries that keep the leading zero in the national number.
 *
 * Nearly everywhere, a leading `0` is a *trunk prefix* — dialled domestically,
 * dropped internationally — so `020 7123 4567` in the UK is `+44 20 7123 4567`.
 * Italy is the well-known exception: the zero is part of the number and
 * `+39 06 …` is correct. Encoding the exception is smaller and more honest than
 * pretending the rule is universal.
 */
const KEEPS_LEADING_ZERO = new Set(['IT'])

/** Drop a national trunk prefix, if this country uses one. */
export function stripTrunkPrefix(country: Country | undefined, digits: string): string {
  if (country === undefined) return digits
  if (KEEPS_LEADING_ZERO.has(country.iso2)) return digits
  // Only one zero, and only at the front: `00` is an international prefix and
  // is handled before this is ever reached.
  return digits.startsWith('0') ? digits.slice(1) : digits
}

/** Accepted national-number lengths for a country, or the generic E.164 bounds. */
export function lengthsFor(country: Country | undefined): { min: number; max: number } {
  if (country === undefined || country.lengths.length === 0) {
    return { min: MIN_NATIONAL_DIGITS, max: MAX_NATIONAL_DIGITS }
  }
  return { min: Math.min(...country.lengths), max: Math.max(...country.lengths) }
}

/** The national part is a length this country actually uses. */
export function isPossible(country: Country | undefined, national: string): boolean {
  if (national === '') return false
  if (country === undefined) {
    return national.length >= MIN_NATIONAL_DIGITS && national.length <= MAX_NATIONAL_DIGITS
  }
  if (country.lengths.length === 0) {
    return national.length >= MIN_NATIONAL_DIGITS && national.length <= MAX_NATIONAL_DIGITS
  }
  return country.lengths.includes(national.length)
}

/**
 * Interpret raw input.
 *
 * Three shapes are accepted, because users paste all three:
 *
 * - `+44 20 7123 4567` — explicit international, the country comes from the
 *   calling code and `defaultCountry` is ignored
 * - `0044 20 …` — the `00` international prefix, treated identically
 * - `020 7123 4567` — national, interpreted against `defaultCountry`
 */
export function parsePhone(input: string, defaultCountry?: string): ParsedPhone {
  const trimmed = input.trim()
  const digits = digitsOnly(trimmed)
  const selected = defaultCountry === undefined ? undefined : countryByISO2(defaultCountry)

  // `00` is the international prefix across most of the world; `011` is the
  // NANP's. Both mean "what follows is a calling code", exactly like `+`.
  const international =
    trimmed.startsWith('+') ||
    digits.startsWith('00') ||
    (selected?.dial === '1' && digits.startsWith('011'))

  if (international) {
    const rest = trimmed.startsWith('+')
      ? digits
      : digits.startsWith('00')
        ? digits.slice(2)
        : digits.slice(3)
    const country = countryForDial(rest)
    const national = country === undefined ? rest : rest.slice(country.dial.length)
    return {
      country,
      national,
      e164: country === undefined || national === '' ? '' : `+${country.dial}${national}`,
      // An explicit `+` whose calling code matches nothing is not "possible" at
      // any length. Falling through to the generic 4–15 bounds here would
      // report `+99 12345` as fine, which is the one case where the international
      // prefix tells us for certain that it is not.
      possible: country === undefined ? false : isPossible(country, national),
    }
  }

  const national = stripTrunkPrefix(selected, digits)
  return {
    country: selected,
    national,
    e164: selected === undefined || national === '' ? '' : `+${selected.dial}${national}`,
    possible: isPossible(selected, national),
  }
}

/** Fallback grouping when the table has no convention for a country. */
const GENERIC_GROUP = 3

/**
 * Group national digits for display.
 *
 * Groups are applied as far as they go; anything past the last known group is
 * emitted in threes rather than run together, so an over-long number still
 * reads as digits instead of a wall.
 */
export function formatNational(national: string, groups: number[]): string {
  if (national === '') return ''
  const parts: string[] = []
  let index = 0

  for (const size of groups) {
    if (index >= national.length) break
    parts.push(national.slice(index, index + size))
    index += size
  }
  while (index < national.length) {
    parts.push(national.slice(index, index + GENERIC_GROUP))
    index += GENERIC_GROUP
  }

  return parts.join(' ')
}

/**
 * What the input shows.
 *
 * In international mode the calling code is part of the text, because the user
 * typed it and deleting it has to be possible. In national mode the country is
 * carried by the select beside the field, so repeating it in the text would be
 * both redundant and editable in two places at once.
 */
export function formatPhone(parsed: ParsedPhone, international: boolean): string {
  const national = formatNational(parsed.national, parsed.country?.groups ?? [])
  if (!international) return national
  if (parsed.country === undefined) {
    // A bare `+` formats as `+`, not as nothing. This is the first keystroke of
    // every international number: returning `''` here erased the plus the
    // instant it was typed, so the digits that followed were read as a national
    // number and the country could never change. Character-by-character entry
    // is the only way to see it — filling the whole string at once hides it.
    return `+${parsed.national}`
  }
  return national === '' ? `+${parsed.country.dial}` : `+${parsed.country.dial} ${national}`
}

/**
 * Where the caret should land after reformatting.
 *
 * Formatting inserts spaces, so the raw offset the browser reports is wrong the
 * moment a separator appears before it. Counting *digits* rather than
 * characters is the only stable anchor: find how many digits preceded the
 * caret, then walk the formatted string until that many have been passed.
 */
export function caretForDigitIndex(formatted: string, digitsBefore: number): number {
  if (digitsBefore <= 0) return formatted.startsWith('+') ? 1 : 0
  let seen = 0
  for (let index = 0; index < formatted.length; index++) {
    // `?? ''` is unreachable: `index` is bounded by the string's own length.
    /* v8 ignore next */
    if (/\d/.test(formatted[index] ?? '')) {
      seen++
      if (seen === digitsBefore) return index + 1
    }
  }
  return formatted.length
}

/** How many digits sit before `caret` in `text`. */
export function digitsBeforeCaret(text: string, caret: number): number {
  return digitsOnly(text.slice(0, caret)).length
}

/**
 * Remove the digit the user was reaching for, skipping separators.
 *
 * A deletion whose caret sits at a group boundary removes the *separator*, and
 * the formatter puts it straight back on the next render: the value comes back
 * identical and the keystroke is dead. Backspacing through `415 555 2671` cost
 * two presses at every boundary.
 *
 * `step` is -1 for Backspace, which takes the digit behind the caret and lands
 * on it, and 1 for Delete, which takes the digit ahead and leaves the caret
 * where it is. One function rather than two mirrored ones: the pair cost more
 * than the size budget allowed, and the asymmetry is one ternary.
 */
export function deleteDigit(
  text: string,
  caret: number,
  step: -1 | 1,
): { text: string; caret: number } {
  for (let at = step < 0 ? caret - 1 : caret; at >= 0 && at < text.length; at += step) {
    // `?? ''` is unreachable: `at` is bounded by the string's own length.
    /* v8 ignore next */
    if (/\d/.test(text[at] ?? '')) {
      return { text: text.slice(0, at) + text.slice(at + 1), caret: step < 0 ? at : caret }
    }
  }
  return { text, caret }
}
