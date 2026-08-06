'use client'

import { useState } from 'react'
import FormControl from '@mui/material/FormControl'
import FormHelperText from '@mui/material/FormHelperText'
import FormLabel from '@mui/material/FormLabel'
import { Rating } from '@rxova/react-rating-input'

export function MuiRating() {
  const [value, setValue] = useState(4)

  return (
    <FormControl>
      <FormLabel>Rating</FormLabel>
      <Rating label="Rating" name="rating" value={value} onChange={setValue} />
      <FormHelperText>Choose a score from one to five.</FormHelperText>
    </FormControl>
  )
}
