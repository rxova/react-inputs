'use client'

import { Form } from 'antd'
import { MeasurementInput } from '@rxova/react-measurement-input'

export function AntMeasurement() {
  return (
    <Form.Item label="Height" extra="Feet and inches, or switch the units.">
      <MeasurementInput label="Height" name="height" units={['foot', 'inch']} />
    </Form.Item>
  )
}
