'use client'

import { useState } from 'react'
import { Box, Text } from '@radix-ui/themes'
import { Rating } from '@rxova/react-rating-input'

export function RadixRating() {
  const [value, setValue] = useState(4)

  return (
    <Box>
      <Text as="div" size="2" weight="bold" mb="1">
        Rating
      </Text>
      <Rating label="Rating" name="rating" value={value} onChange={setValue} />
      <Text as="div" size="1" color="gray" mt="1">
        Choose a score from one to five.
      </Text>
    </Box>
  )
}
