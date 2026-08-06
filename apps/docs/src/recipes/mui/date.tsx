'use client'

import FormControl from '@mui/material/FormControl'
import FormHelperText from '@mui/material/FormHelperText'
import FormLabel from '@mui/material/FormLabel'
import { DateInput } from '@rxova/react-date-input'

export function MuiDate() {
  return (
    <FormControl>
      <FormLabel>Start date</FormLabel>
      <DateInput label="Start date" name="startDate" locale="en-US" />
      <FormHelperText>Enter a calendar date.</FormHelperText>
    </FormControl>
  )
}
