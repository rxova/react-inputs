'use client'

import { useState } from 'react'
import { Field } from '@chakra-ui/react'
import { Rating } from '@rxova/react-rating-input'

export function ChakraRating() {
  const [value, setValue] = useState(4)

  return (
    <Field.Root>
      <Field.Label>Rating</Field.Label>
      <Rating label="Rating" name="rating" value={value} onChange={setValue} />
      <Field.HelperText>Choose a score from one to five.</Field.HelperText>
    </Field.Root>
  )
}
