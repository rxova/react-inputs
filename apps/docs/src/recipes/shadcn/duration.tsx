'use client'

import { DurationField } from '@/components/rxova/duration-field'

export function ShadcnDuration() {
  return (
    <DurationField
      label="Estimate"
      description="How long the task should take."
      name="estimate"
      units={['hour', 'minute']}
    />
  )
}
