'use client'

import { useState } from 'react'
import { Field, Input } from '@chakra-ui/react'
import { useCurrencyInput } from '@rxova/react-intl-currency-input'

export function ChakraCurrency() {
  const [value, setValue] = useState<number | null>(null)
  const { inputProps, ref } = useCurrencyInput({
    locale: 'en-US',
    currency: 'USD',
    value,
    onChange: setValue,
  })

  return (
    <Field.Root>
      <Field.Label>Price</Field.Label>
      <Input {...inputProps} ref={ref} name="price" />
      <Field.HelperText>Enter the price before tax.</Field.HelperText>
    </Field.Root>
  )
}
