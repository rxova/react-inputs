'use client'

import { Form } from 'antd'
import { FileInput } from '@rxova/react-file-input'

export function AntFile() {
  return (
    <Form.Item label="Attachments" extra="Choose one or more files.">
      <FileInput label="Attachments" name="attachments" multiple />
    </Form.Item>
  )
}
