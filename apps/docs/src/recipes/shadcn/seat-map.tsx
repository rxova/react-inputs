'use client'

import { useState } from 'react'
import { parseLayout } from '@rxova/react-seat-map-input'
import { SeatMapField } from '@/components/rxova/seat-map-field'

const SEATS = parseLayout(`
  10: ###_###
  11: ##x_x##
  12: ###_###
`)

export function ShadcnSeatMap() {
  const [seats, setSeats] = useState<string[]>([])

  return (
    <SeatMapField
      label="Seats"
      description="Choose up to four seats. Arrow keys move around the cabin."
      name="seats"
      sections={SEATS}
      value={seats}
      onChange={setSeats}
      maxSeats={4}
    />
  )
}
