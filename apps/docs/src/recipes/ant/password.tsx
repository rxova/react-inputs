'use client'

import { Form } from 'antd'
import { PasswordInput } from '@rxova/react-password-input'

export function AntPassword() {
  return (
    <Form.Item label="Password" extra="Use at least eight characters.">
      <PasswordInput label="Password" name="password" showStrength />
    </Form.Item>
  )
}
