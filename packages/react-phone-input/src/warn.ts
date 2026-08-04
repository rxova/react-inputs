import { countryByISO2 } from './countries'
import { parsePhone } from './phone'
import type { PhoneWarning } from './types'

/**
 * Development-only diagnostics.
 *
 * Every function here is reached exclusively from the `NODE_ENV !== 'production'`
 * branch in `usePhoneInput`, so a production bundler drops this whole module.
 * The coercion itself lives in the hook and always runs; this only *describes* a
 * coercion that already happened.
 */

/** Describe an ISO code the table does not know. */
export function inspectCountry(iso2: string, prop: string): PhoneWarning | null {
  if (countryByISO2(iso2) !== undefined) return null
  const looksLikeName = iso2.length > 2
  return {
    code: prop === 'defaultCountry' ? 'unknown-default-country' : 'unknown-country',
    prop,
    received: iso2,
    message: looksLikeName
      ? `\`${prop}\` is "${iso2}"; it must be a two-letter ISO 3166-1 alpha-2 code such as "GB", not a country name or calling code.`
      : `\`${prop}\` is "${iso2}", which is not in the country table. Falling back to the default.`,
  }
}

/**
 * Describe a `value` that is not E.164.
 *
 * Two distinct mistakes, and they fail differently: `'020 7123 4567'` is a
 * national number with no country, and `'+99 123'` has a calling code nobody
 * uses. Both leave the field showing something the caller did not intend.
 */
export function inspectValue(value: string, prop: string): PhoneWarning | null {
  if (value === '') return null
  if (!value.startsWith('+')) {
    return {
      code: 'value-not-e164',
      prop,
      received: value,
      message: `\`${prop}\` must be in E.164 form ("+14155552671"); received "${value}". Interpreting it against the selected country instead.`,
    }
  }
  if (parsePhone(value).country === undefined) {
    return {
      code: 'value-country-unknown',
      prop,
      received: value,
      message: `\`${prop}\` ("${value}") starts with a calling code that is not in the country table. The digits are kept, but no country could be resolved.`,
    }
  }
  return null
}

/** Describe a `countries` array that would leave the picker empty. */
export function inspectCountryList(countries: string[] | undefined): PhoneWarning | null {
  if (countries === undefined) return null
  if (countries.length === 0) {
    return {
      code: 'empty-country-list',
      prop: 'countries',
      received: '[]',
      message:
        '`countries` is empty, which would leave the picker with nothing to choose. Ignoring it and showing the full list.',
    }
  }
  const unknown = countries.filter((iso2) => countryByISO2(iso2) === undefined)
  if (unknown.length === 0) return null
  return {
    code: 'unknown-country',
    prop: 'countries',
    received: unknown.join(', '),
    message: `\`countries\` contains ${String(unknown.length)} code(s) not in the table: ${unknown.join(', ')}. They are ignored.`,
  }
}

/** Describe a locale tag `Intl` refused. */
export function inspectLocale(locale: string): PhoneWarning | null {
  try {
    new Intl.DisplayNames([locale], { type: 'region' })
    return null
  } catch {
    return {
      code: 'locale-invalid',
      prop: 'locale',
      received: locale,
      message: `\`locale\` "${locale}" is not a valid BCP 47 tag (note the hyphen: "en-US", not "en_US"). Country names fall back to their ISO codes.`,
    }
  }
}
