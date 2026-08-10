'use client'

import { Input } from '@mantine/core'
import { MeasurementInput } from '@rxova/react-measurement-input'

export function MantineMeasurement() {
  return (
    <Input.Wrapper label="Height" description="Feet and inches, or switch the units.">
      <MeasurementInput label="Height" name="height" units={['foot', 'inch']} />
    </Input.Wrapper>
  )
}
