'use client'

import { useState } from 'react'
import { Text, TextField } from '@radix-ui/themes'
import { useCurrencyInput } from '@rxova/react-intl-currency-input'

export function RadixCurrency() {
  const [value, setValue] = useState<number | null>(null)
  const { inputProps, ref } = useCurrencyInput({
    locale: 'en-US',
    currency: 'USD',
    value,
    onChange: setValue,
  })

  return (
    <label>
      <Text as="div" size="2" weight="bold" mb="1">
        Price
      </Text>
      <TextField.Root {...inputProps} ref={ref} name="price" />
    </label>
  )
}
