'use client'

import { Box, Text } from '@radix-ui/themes'
import { TimeInput } from '@rxova/react-time-input'

export function RadixTime() {
  return (
    <Box>
      <Text as="div" size="2" weight="bold" mb="1">
        Start time
      </Text>
      <TimeInput label="Start time" name="startTime" locale="en-US" />
      <Text as="div" size="1" color="gray" mt="1">
        Enter a local time.
      </Text>
    </Box>
  )
}
