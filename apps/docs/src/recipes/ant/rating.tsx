'use client'

import { useState } from 'react'
import { Form } from 'antd'
import { Rating } from '@rxova/react-rating-input'

export function AntRating() {
  const [value, setValue] = useState(4)

  return (
    <Form.Item label="Rating" extra="Choose a score from one to five.">
      <Rating label="Rating" name="rating" value={value} onChange={setValue} />
    </Form.Item>
  )
}
