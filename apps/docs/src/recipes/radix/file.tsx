'use client'

import { Box, Text } from '@radix-ui/themes'
import { FileInput } from '@rxova/react-file-input'

export function RadixFile() {
  return (
    <Box>
      <Text as="div" size="2" weight="bold" mb="1">
        Attachments
      </Text>
      <FileInput label="Attachments" name="attachments" multiple />
      <Text as="div" size="1" color="gray" mt="1">
        Choose one or more files.
      </Text>
    </Box>
  )
}
