'use client'

import { Input } from '@mantine/core'
import { DateInput } from '@rxova/react-date-input'

export function MantineDate() {
  return (
    <Input.Wrapper label="Start date" description="Enter a calendar date.">
      <DateInput label="Start date" name="startDate" locale="en-US" />
    </Input.Wrapper>
  )
}
