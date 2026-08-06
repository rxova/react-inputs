'use client'

import { Field } from '@chakra-ui/react'
import { PasswordInput } from '@rxova/react-password-input'

export function ChakraPassword() {
  return (
    <Field.Root>
      <Field.Label>Password</Field.Label>
      <PasswordInput label="Password" name="password" showStrength />
      <Field.HelperText>Use at least eight characters.</Field.HelperText>
    </Field.Root>
  )
}
