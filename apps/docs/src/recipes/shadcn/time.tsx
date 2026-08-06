'use client'

import { TimeField } from '@/components/rxova/time-field'

export function ShadcnTime() {
  return (
    <TimeField
      label="Start time"
      description="Enter a local time."
      name="startTime"
      locale="en-US"
    />
  )
}
