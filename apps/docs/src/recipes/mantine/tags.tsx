'use client'

import { Input } from '@mantine/core'
import { TagsInput } from '@rxova/react-tags-input'

export function MantineTags() {
  return (
    <Input.Wrapper label="Tags" description="Press Enter or comma to add a tag.">
      <TagsInput label="Tags" name="tags" defaultValue={['react']} />
    </Input.Wrapper>
  )
}
