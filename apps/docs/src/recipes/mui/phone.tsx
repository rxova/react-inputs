'use client'

import FormControl from '@mui/material/FormControl'
import FormHelperText from '@mui/material/FormHelperText'
import FormLabel from '@mui/material/FormLabel'
import { PhoneInput } from '@rxova/react-phone-input'

export function MuiPhone() {
  return (
    <FormControl>
      <FormLabel>Phone number</FormLabel>
      <PhoneInput label="Phone number" name="phone" defaultCountry="US" />
      <FormHelperText>Include a country calling code.</FormHelperText>
    </FormControl>
  )
}
