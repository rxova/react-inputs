'use client'

import { useState } from 'react'
import { Box, Text } from '@radix-ui/themes'
import { SeatMap, parseLayout } from '@rxova/react-seat-map-input'

const SEATS = parseLayout(`
  10: ###_###
  11: ##x_x##
  12: ###_###
`)

export function RadixSeatMap() {
  const [seats, setSeats] = useState<string[]>([])

  return (
    <Box>
      <Text as="div" size="2" weight="bold" mb="1">
        Seats
      </Text>
      <SeatMap label="Seats" name="seats" sections={SEATS} value={seats} onChange={setSeats} />
      <Text as="div" size="1" color="gray" mt="1">
        Choose up to four seats. Arrow keys move around the cabin.
      </Text>
    </Box>
  )
}
