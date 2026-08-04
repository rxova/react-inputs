'use client'

export { PhoneInput } from './PhoneInput'
export { usePhoneInput } from './usePhoneInput'
export type { UsePhoneInputOptions, UsePhoneInputResult } from './usePhoneInput'
export {
  COUNTRIES,
  MAX_NATIONAL_DIGITS,
  MIN_NATIONAL_DIGITS,
  countryByISO2,
  countryForDial,
  countryName,
  flagEmoji,
} from './countries'
export type { Country } from './countries'
export {
  digitsOnly,
  formatNational,
  formatPhone,
  isPossible,
  lengthsFor,
  parsePhone,
} from './phone'
export type { ParsedPhone } from './phone'
export type {
  PhoneCountryState,
  PhoneDetails,
  PhoneInputProps,
  PhoneWarning,
  PhoneWarningCode,
} from './types'
