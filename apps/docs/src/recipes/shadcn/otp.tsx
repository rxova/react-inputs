'use client'

import { OtpField } from '@/components/rxova/otp-field'

export function ShadcnOtp() {
  return (
    <OtpField
      label="Verification code"
      description="Enter the six-digit code."
      name="code"
      length={6}
    />
  )
}
