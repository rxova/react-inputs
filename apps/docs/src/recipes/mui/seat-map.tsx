'use client'

import { useState } from 'react'
import FormControl from '@mui/material/FormControl'
import FormHelperText from '@mui/material/FormHelperText'
import FormLabel from '@mui/material/FormLabel'
import { SeatMap, parseLayout } from '@rxova/react-seat-map-input'

const SEATS = parseLayout(`
  10: ###_###
  11: ##x_x##
  12: ###_###
`)

export function MuiSeatMap() {
  const [seats, setSeats] = useState<string[]>([])

  return (
    <FormControl>
      <FormLabel>Seats</FormLabel>
      <SeatMap label="Seats" name="seats" sections={SEATS} value={seats} onChange={setSeats} />
      <FormHelperText>Choose up to four seats. Arrow keys move around the cabin.</FormHelperText>
    </FormControl>
  )
}
