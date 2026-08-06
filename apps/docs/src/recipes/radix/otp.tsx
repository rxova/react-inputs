'use client'

import { Box, Text } from '@radix-ui/themes'
import { OtpInput } from '@rxova/react-otp-input'

export function RadixOtp() {
  return (
    <Box>
      <Text as="div" size="2" weight="bold" mb="1">
        Verification code
      </Text>
      <OtpInput label="Verification code" name="code" length={6} />
      <Text as="div" size="1" color="gray" mt="1">
        Enter the six-digit code.
      </Text>
    </Box>
  )
}
