'use client'

import { Form } from 'antd'
import { OtpInput } from '@rxova/react-otp-input'

export function AntOtp() {
  return (
    <Form.Item label="Verification code" extra="Enter the six-digit code.">
      <OtpInput label="Verification code" name="code" length={6} />
    </Form.Item>
  )
}
