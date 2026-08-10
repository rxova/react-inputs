'use client'

import { TimezoneField } from '@/components/rxova/timezone-field'

export function ShadcnTimezone() {
  return (
    <TimezoneField
      label="Time zone"
      description="Times on your schedule are shown in this zone."
      name="zone"
    />
  )
}
