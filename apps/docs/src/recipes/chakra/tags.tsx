'use client'

import { Field } from '@chakra-ui/react'
import { TagsInput } from '@rxova/react-tags-input'

export function ChakraTags() {
  return (
    <Field.Root>
      <Field.Label>Tags</Field.Label>
      <TagsInput label="Tags" name="tags" defaultValue={['react']} />
      <Field.HelperText>Press Enter or comma to add a tag.</Field.HelperText>
    </Field.Root>
  )
}
