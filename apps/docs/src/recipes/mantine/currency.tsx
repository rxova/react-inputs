'use client'

import { useState } from 'react'
import { TextInput } from '@mantine/core'
import { useCurrencyInput } from '@rxova/react-intl-currency-input'

export function MantineCurrency() {
  const [value, setValue] = useState<number | null>(null)
  const { inputProps, ref } = useCurrencyInput({
    locale: 'en-US',
    currency: 'USD',
    value,
    onChange: setValue,
  })

  return (
    <TextInput
      {...inputProps}
      ref={ref}
      name="price"
      label="Price"
      description="Enter the price before tax."
    />
  )
}
