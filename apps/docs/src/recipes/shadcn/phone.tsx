'use client'

import { PhoneField } from '@/components/rxova/phone-field'

export function ShadcnPhone() {
  return (
    <PhoneField
      label="Phone number"
      description="Include a country calling code."
      name="phone"
      defaultCountry="US"
    />
  )
}
