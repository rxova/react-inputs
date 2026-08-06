'use client'

import { Form } from 'antd'
import { PhoneInput } from '@rxova/react-phone-input'

export function AntPhone() {
  return (
    <Form.Item label="Phone number" extra="Include a country calling code.">
      <PhoneInput label="Phone number" name="phone" defaultCountry="US" />
    </Form.Item>
  )
}
