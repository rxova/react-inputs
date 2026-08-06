'use client'

import { Form } from 'antd'
import { TimeInput } from '@rxova/react-time-input'

export function AntTime() {
  return (
    <Form.Item label="Start time" extra="Enter a local time.">
      <TimeInput label="Start time" name="startTime" locale="en-US" />
    </Form.Item>
  )
}
