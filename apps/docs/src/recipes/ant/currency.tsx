'use client'

import { useState } from 'react'
import { Form, Input } from 'antd'
import { useCurrencyInput } from '@rxova/react-intl-currency-input'

export function AntCurrency() {
  const [value, setValue] = useState<number | null>(null)
  const { inputProps } = useCurrencyInput({
    locale: 'en-US',
    currency: 'USD',
    formatMode: 'blur',
    value,
    onChange: setValue,
  })

  return (
    <Form.Item label="Price" extra="Enter the price before tax.">
      <Input {...inputProps} name="price" />
    </Form.Item>
  )
}
