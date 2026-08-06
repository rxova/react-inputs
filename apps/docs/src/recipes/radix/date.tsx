'use client'

import { Box, Text } from '@radix-ui/themes'
import { DateInput } from '@rxova/react-date-input'

export function RadixDate() {
  return (
    <Box>
      <Text as="div" size="2" weight="bold" mb="1">
        Start date
      </Text>
      <DateInput label="Start date" name="startDate" locale="en-US" />
      <Text as="div" size="1" color="gray" mt="1">
        Enter a calendar date.
      </Text>
    </Box>
  )
}
