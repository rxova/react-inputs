'use client'

import { useState } from 'react'
import { RatingField } from '@/components/rxova/rating-field'

export function ShadcnRating() {
  const [value, setValue] = useState(4)

  return (
    <RatingField
      label="Rating"
      description="Choose a score from one to five."
      name="rating"
      value={value}
      onChange={setValue}
    />
  )
}
