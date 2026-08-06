'use client'

import { useState } from 'react'
import TextField from '@mui/material/TextField'
import { useCurrencyInput } from '@rxova/react-intl-currency-input'

export function MuiCurrency() {
  const [value, setValue] = useState<number | null>(null)
  const { inputProps, ref } = useCurrencyInput({
    locale: 'en-US',
    currency: 'USD',
    value,
    onChange: setValue,
  })

  return (
    <TextField
      name="price"
      label="Price"
      helperText="Enter the price before tax."
      slotProps={{ htmlInput: { ...inputProps, ref } }}
    />
  )
}
