'use client'

import { CurrencyField } from '@/components/rxova/currency-field'

export function ShadcnCurrency() {
  return (
    <CurrencyField
      label="Price"
      description="Enter the price before tax."
      name="price"
      locale="en-US"
      currency="USD"
      defaultValue={1250}
    />
  )
}
