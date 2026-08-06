'use client'

import { Input } from '@mantine/core'
import { PasswordInput } from '@rxova/react-password-input'

export function MantinePassword() {
  return (
    <Input.Wrapper label="Password" description="Use at least eight characters.">
      <PasswordInput label="Password" name="password" showStrength />
    </Input.Wrapper>
  )
}
