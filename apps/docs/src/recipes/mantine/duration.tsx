'use client'

import { Input } from '@mantine/core'
import { DurationInput } from '@rxova/react-duration-input'

export function MantineDuration() {
  return (
    <Input.Wrapper label="Estimate" description="How long the task should take.">
      <DurationInput label="Estimate" name="estimate" units={['hour', 'minute']} />
    </Input.Wrapper>
  )
}
