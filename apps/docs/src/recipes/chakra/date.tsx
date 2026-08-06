'use client'

import { Field } from '@chakra-ui/react'
import { DateInput } from '@rxova/react-date-input'

export function ChakraDate() {
  return (
    <Field.Root>
      <Field.Label>Start date</Field.Label>
      <DateInput label="Start date" name="startDate" locale="en-US" />
      <Field.HelperText>Enter a calendar date.</Field.HelperText>
    </Field.Root>
  )
}
