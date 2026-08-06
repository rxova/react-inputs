'use client'

import FormControl from '@mui/material/FormControl'
import FormHelperText from '@mui/material/FormHelperText'
import FormLabel from '@mui/material/FormLabel'
import { PasswordInput } from '@rxova/react-password-input'

export function MuiPassword() {
  return (
    <FormControl>
      <FormLabel>Password</FormLabel>
      <PasswordInput label="Password" name="password" showStrength />
      <FormHelperText>Use at least eight characters.</FormHelperText>
    </FormControl>
  )
}
