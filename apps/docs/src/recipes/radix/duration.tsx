'use client'

import { Box, Text } from '@radix-ui/themes'
import { DurationInput } from '@rxova/react-duration-input'

export function RadixDuration() {
  return (
    <Box>
      <Text as="div" size="2" weight="bold" mb="1">
        Estimate
      </Text>
      <DurationInput label="Estimate" name="estimate" units={['hour', 'minute']} />
      <Text as="div" size="1" color="gray" mt="1">
        How long the task should take.
      </Text>
    </Box>
  )
}
