'use client'

import { Form } from 'antd'
import { DurationInput } from '@rxova/react-duration-input'

export function AntDuration() {
  return (
    <Form.Item label="Estimate" extra="How long the task should take.">
      <DurationInput label="Estimate" name="estimate" units={['hour', 'minute']} />
    </Form.Item>
  )
}
