'use client'

import { Field } from '@chakra-ui/react'
import { PhoneInput } from '@rxova/react-phone-input'

export function ChakraPhone() {
  return (
    <Field.Root>
      <Field.Label>Phone number</Field.Label>
      <PhoneInput label="Phone number" name="phone" defaultCountry="US" />
      <Field.HelperText>Include a country calling code.</Field.HelperText>
    </Field.Root>
  )
}
