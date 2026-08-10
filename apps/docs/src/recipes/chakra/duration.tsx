'use client'

import { Field } from '@chakra-ui/react'
import { DurationInput } from '@rxova/react-duration-input'

export function ChakraDuration() {
  return (
    <Field.Root>
      <Field.Label>Estimate</Field.Label>
      <DurationInput label="Estimate" name="estimate" units={['hour', 'minute']} />
      <Field.HelperText>How long the task should take.</Field.HelperText>
    </Field.Root>
  )
}
