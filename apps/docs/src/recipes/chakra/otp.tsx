'use client'

import { Field } from '@chakra-ui/react'
import { OtpInput } from '@rxova/react-otp-input'

export function ChakraOtp() {
  return (
    <Field.Root>
      <Field.Label>Verification code</Field.Label>
      <OtpInput label="Verification code" name="code" length={6} />
      <Field.HelperText>Enter the six-digit code.</Field.HelperText>
    </Field.Root>
  )
}
