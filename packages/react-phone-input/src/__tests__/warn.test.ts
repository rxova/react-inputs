import { describe, expect, it } from 'vitest'
import { inspectCountry, inspectCountryList, inspectLocale, inspectValue } from '../warn'

/**
 * These inspectors only *describe* a coercion the hook has already applied, so
 * the contract is: a usable prop returns `null`, and an unusable one returns a
 * warning whose message names what arrived and what happens instead. A warning
 * that does not say what it fell back to is noise.
 */
describe('inspectCountry', () => {
  it('passes a code in the table', () => {
    expect(inspectCountry('GB', 'country')).toBeNull()
    expect(inspectCountry('gb', 'defaultCountry')).toBeNull()
  })

  it('uses a different code for each prop, so a switch can tell them apart', () => {
    expect(inspectCountry('ZZ', 'country')?.code).toBe('unknown-country')
    expect(inspectCountry('ZZ', 'defaultCountry')?.code).toBe('unknown-default-country')
  })

  it('says what an ISO code is when given something longer', () => {
    // The most likely mistake is passing a name or a calling code.
    const warning = inspectCountry('United Kingdom', 'defaultCountry')
    expect(warning?.message).toContain('ISO 3166-1')
    expect(warning?.message).toContain('"GB"')
  })

  it('says it is falling back when given a two-letter code it does not know', () => {
    const warning = inspectCountry('ZZ', 'country')
    expect(warning?.message).toContain('ZZ')
    expect(warning?.message).toContain('Falling back')
  })
})

describe('inspectValue', () => {
  it('passes an empty value and a well-formed E.164 number', () => {
    expect(inspectValue('', 'value')).toBeNull()
    expect(inspectValue('+14155552671', 'value')).toBeNull()
  })

  it('reports a national number passed where E.164 belongs', () => {
    const warning = inspectValue('020 7123 4567', 'value')
    expect(warning?.code).toBe('value-not-e164')
    expect(warning?.message).toContain('+14155552671')
  })

  it('reports a calling code nobody uses separately', () => {
    // A different mistake with a different fix, so a different code.
    expect(inspectValue('+9912345678', 'value')?.code).toBe('value-country-unknown')
  })

  it('names the prop it was given', () => {
    expect(inspectValue('020 7123', 'defaultValue')?.prop).toBe('defaultValue')
  })
})

describe('inspectCountryList', () => {
  it('passes an absent or fully-known list', () => {
    expect(inspectCountryList(undefined)).toBeNull()
    expect(inspectCountryList(['GB', 'US', 'fr'])).toBeNull()
  })

  it('reports an empty list, which would leave nothing to pick', () => {
    expect(inspectCountryList([])?.code).toBe('empty-country-list')
  })

  it('reports unknown codes and names them all', () => {
    const warning = inspectCountryList(['GB', 'ZZ', 'QQ'])
    expect(warning?.code).toBe('unknown-country')
    expect(warning?.message).toContain('ZZ')
    expect(warning?.message).toContain('QQ')
    expect(warning?.message).toContain('2')
  })
})

describe('inspectLocale', () => {
  it('passes a well-formed tag', () => {
    expect(inspectLocale('en-US')).toBeNull()
    expect(inspectLocale('fr')).toBeNull()
  })

  it('reports a tag Intl refuses, and points at the hyphen', () => {
    const warning = inspectLocale('en_US')
    expect(warning?.code).toBe('locale-invalid')
    expect(warning?.message).toContain('en-US')
  })
})
