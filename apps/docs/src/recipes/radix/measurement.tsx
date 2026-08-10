'use client'

import { Box, Text } from '@radix-ui/themes'
import { MeasurementInput } from '@rxova/react-measurement-input'

export function RadixMeasurement() {
  return (
    <Box>
      <Text as="div" size="2" weight="bold" mb="1">
        Height
      </Text>
      <MeasurementInput label="Height" name="height" units={['foot', 'inch']} />
      <Text as="div" size="1" color="gray" mt="1">
        Feet and inches, or switch the units.
      </Text>
    </Box>
  )
}
