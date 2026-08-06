'use client'

import FormControl from '@mui/material/FormControl'
import FormHelperText from '@mui/material/FormHelperText'
import FormLabel from '@mui/material/FormLabel'
import { TagsInput } from '@rxova/react-tags-input'

export function MuiTags() {
  return (
    <FormControl>
      <FormLabel>Tags</FormLabel>
      <TagsInput label="Tags" name="tags" defaultValue={['react']} />
      <FormHelperText>Press Enter or comma to add a tag.</FormHelperText>
    </FormControl>
  )
}
