'use client'

import { Field } from '@chakra-ui/react'
import { MeasurementInput } from '@rxova/react-measurement-input'

export function ChakraMeasurement() {
  return (
    <Field.Root>
      <Field.Label>Height</Field.Label>
      <MeasurementInput label="Height" name="height" units={['foot', 'inch']} />
      <Field.HelperText>Feet and inches, or switch the units.</Field.HelperText>
    </Field.Root>
  )
}
