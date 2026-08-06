'use client'

import { DateField } from '@/components/rxova/date-field'

export function ShadcnDate() {
  return (
    <DateField
      label="Start date"
      description="Enter a calendar date."
      name="startDate"
      locale="en-US"
    />
  )
}
