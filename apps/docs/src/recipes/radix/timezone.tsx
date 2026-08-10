'use client'

import { Box, Text } from '@radix-ui/themes'
import { TimezoneInput } from '@rxova/react-timezone-input'

export function RadixTimezone() {
  return (
    <Box>
      <Text as="div" size="2" weight="bold" mb="1">
        Time zone
      </Text>
      <TimezoneInput label="Time zone" name="zone" />
      <Text as="div" size="1" color="gray" mt="1">
        Times on your schedule are shown in this zone.
      </Text>
    </Box>
  )
}
