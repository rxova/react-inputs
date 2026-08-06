'use client'

import { TagsField } from '@/components/rxova/tags-field'

export function ShadcnTags() {
  return (
    <TagsField
      label="Tags"
      description="Press Enter or comma to add a tag."
      name="tags"
      defaultValue={['react']}
    />
  )
}
