'use client'

import { Box, Text } from '@radix-ui/themes'
import { TagsInput } from '@rxova/react-tags-input'

export function RadixTags() {
  return (
    <Box>
      <Text as="div" size="2" weight="bold" mb="1">
        Tags
      </Text>
      <TagsInput label="Tags" name="tags" defaultValue={['react']} />
      <Text as="div" size="1" color="gray" mt="1">
        Press Enter or comma to add a tag.
      </Text>
    </Box>
  )
}
