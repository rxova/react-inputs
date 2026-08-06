'use client'

import { Input } from '@mantine/core'
import { OtpInput } from '@rxova/react-otp-input'

export function MantineOtp() {
  return (
    <Input.Wrapper label="Verification code" description="Enter the six-digit code.">
      <OtpInput label="Verification code" name="code" length={6} />
    </Input.Wrapper>
  )
}
