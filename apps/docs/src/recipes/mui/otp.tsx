'use client'

import FormControl from '@mui/material/FormControl'
import FormHelperText from '@mui/material/FormHelperText'
import FormLabel from '@mui/material/FormLabel'
import { OtpInput } from '@rxova/react-otp-input'

export function MuiOtp() {
  return (
    <FormControl>
      <FormLabel>Verification code</FormLabel>
      <OtpInput label="Verification code" name="code" length={6} />
      <FormHelperText>Enter the six-digit code.</FormHelperText>
    </FormControl>
  )
}
