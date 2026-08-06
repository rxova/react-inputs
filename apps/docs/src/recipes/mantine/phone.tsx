'use client'

import { Input } from '@mantine/core'
import { PhoneInput } from '@rxova/react-phone-input'

export function MantinePhone() {
  return (
    <Input.Wrapper label="Phone number" description="Include a country calling code.">
      <PhoneInput label="Phone number" name="phone" defaultCountry="US" />
    </Input.Wrapper>
  )
}
