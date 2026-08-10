'use client'

import { Input } from '@mantine/core'
import { TimezoneInput } from '@rxova/react-timezone-input'

export function MantineTimezone() {
  return (
    <Input.Wrapper label="Time zone" description="Times on your schedule are shown in this zone.">
      <TimezoneInput label="Time zone" name="zone" />
    </Input.Wrapper>
  )
}
