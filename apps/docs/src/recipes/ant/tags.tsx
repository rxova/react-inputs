'use client'

import { Form } from 'antd'
import { TagsInput } from '@rxova/react-tags-input'

export function AntTags() {
  return (
    <Form.Item label="Tags" extra="Press Enter or comma to add a tag.">
      <TagsInput label="Tags" name="tags" defaultValue={['react']} />
    </Form.Item>
  )
}
