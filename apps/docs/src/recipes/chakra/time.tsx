'use client'

import { Field } from '@chakra-ui/react'
import { TimeInput } from '@rxova/react-time-input'

export function ChakraTime() {
  return (
    <Field.Root>
      <Field.Label>Start time</Field.Label>
      <TimeInput label="Start time" name="startTime" locale="en-US" />
      <Field.HelperText>Enter a local time.</Field.HelperText>
    </Field.Root>
  )
}
