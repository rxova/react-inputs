'use client'

import { Input } from '@mantine/core'
import { TimeInput } from '@rxova/react-time-input'

export function MantineTime() {
  return (
    <Input.Wrapper label="Start time" description="Enter a local time.">
      <TimeInput label="Start time" name="startTime" locale="en-US" />
    </Input.Wrapper>
  )
}
