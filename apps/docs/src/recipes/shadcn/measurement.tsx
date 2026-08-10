'use client'

import { MeasurementField } from '@/components/rxova/measurement-field'

export function ShadcnMeasurement() {
  return (
    <MeasurementField
      label="Height"
      description="Feet and inches, or switch the units."
      name="height"
      units={['foot', 'inch']}
    />
  )
}
