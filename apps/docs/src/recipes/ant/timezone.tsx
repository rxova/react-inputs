'use client'

import { Form } from 'antd'
import { TimezoneInput } from '@rxova/react-timezone-input'

export function AntTimezone() {
  return (
    <Form.Item label="Time zone" extra="Times on your schedule are shown in this zone.">
      <TimezoneInput label="Time zone" name="zone" />
    </Form.Item>
  )
}
