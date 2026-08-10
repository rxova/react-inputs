'use client'

import { Field } from '@chakra-ui/react'
import { TimezoneInput } from '@rxova/react-timezone-input'

export function ChakraTimezone() {
  return (
    <Field.Root>
      <Field.Label>Time zone</Field.Label>
      <TimezoneInput label="Time zone" name="zone" />
      <Field.HelperText>Times on your schedule are shown in this zone.</Field.HelperText>
    </Field.Root>
  )
}
