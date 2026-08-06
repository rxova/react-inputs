'use client'

import { useState } from 'react'
import { Input } from '@mantine/core'
import { Rating } from '@rxova/react-rating-input'

export function MantineRating() {
  const [value, setValue] = useState(4)

  return (
    <Input.Wrapper label="Rating" description="Choose a score from one to five.">
      <Rating label="Rating" name="rating" value={value} onChange={setValue} />
    </Input.Wrapper>
  )
}
