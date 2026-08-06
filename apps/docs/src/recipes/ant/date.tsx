'use client'

import { Form } from 'antd'
import { DateInput } from '@rxova/react-date-input'

export function AntDate() {
  return (
    <Form.Item label="Start date" extra="Enter a calendar date.">
      <DateInput label="Start date" name="startDate" locale="en-US" />
    </Form.Item>
  )
}
