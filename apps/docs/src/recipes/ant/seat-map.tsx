'use client'

import { useState } from 'react'
import { Form } from 'antd'
import { SeatMap, parseLayout } from '@rxova/react-seat-map-input'

const SEATS = parseLayout(`
  10: ###_###
  11: ##x_x##
  12: ###_###
`)

export function AntSeatMap() {
  const [seats, setSeats] = useState<string[]>([])

  return (
    <Form.Item label="Seats" extra="Choose up to four seats. Arrow keys move around the cabin.">
      <SeatMap label="Seats" name="seats" sections={SEATS} value={seats} onChange={setSeats} />
    </Form.Item>
  )
}
