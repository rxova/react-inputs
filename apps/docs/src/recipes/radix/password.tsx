'use client'

import { Box, Text } from '@radix-ui/themes'
import { PasswordInput } from '@rxova/react-password-input'

export function RadixPassword() {
  return (
    <Box>
      <Text as="div" size="2" weight="bold" mb="1">
        Password
      </Text>
      <PasswordInput label="Password" name="password" showStrength />
      <Text as="div" size="1" color="gray" mt="1">
        Use at least eight characters.
      </Text>
    </Box>
  )
}
