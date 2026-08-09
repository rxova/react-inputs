'use client'

import { useState } from 'react'
import { Input } from '@mantine/core'
import { SeatMap, parseLayout } from '@rxova/react-seat-map-input'

const SEATS = parseLayout(`
  10: ###_###
  11: ##x_x##
  12: ###_###
`)

export function MantineSeatMap() {
  const [seats, setSeats] = useState<string[]>([])

  return (
    <Input.Wrapper
      label="Seats"
      description="Choose up to four seats. Arrow keys move around the cabin."
    >
      <SeatMap label="Seats" name="seats" sections={SEATS} value={seats} onChange={setSeats} />
    </Input.Wrapper>
  )
}
