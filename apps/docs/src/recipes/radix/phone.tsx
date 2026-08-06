'use client'

import { Box, Text } from '@radix-ui/themes'
import { PhoneInput } from '@rxova/react-phone-input'

export function RadixPhone() {
  return (
    <Box>
      <Text as="div" size="2" weight="bold" mb="1">
        Phone number
      </Text>
      <PhoneInput label="Phone number" name="phone" defaultCountry="US" />
      <Text as="div" size="1" color="gray" mt="1">
        Include a country calling code.
      </Text>
    </Box>
  )
}
