'use client'

import { useState } from 'react'
import { Field } from '@chakra-ui/react'
import { SeatMap, parseLayout } from '@rxova/react-seat-map-input'

const SEATS = parseLayout(`
  10: ###_###
  11: ##x_x##
  12: ###_###
`)

export function ChakraSeatMap() {
  const [seats, setSeats] = useState<string[]>([])

  return (
    <Field.Root>
      <Field.Label>Seats</Field.Label>
      <SeatMap label="Seats" name="seats" sections={SEATS} value={seats} onChange={setSeats} />
      <Field.HelperText>
        Choose up to four seats. Arrow keys move around the cabin.
      </Field.HelperText>
    </Field.Root>
  )
}
