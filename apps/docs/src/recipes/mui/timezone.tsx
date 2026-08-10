'use client'

import FormControl from '@mui/material/FormControl'
import FormHelperText from '@mui/material/FormHelperText'
import FormLabel from '@mui/material/FormLabel'
import { TimezoneInput } from '@rxova/react-timezone-input'

export function MuiTimezone() {
  return (
    <FormControl>
      <FormLabel>Time zone</FormLabel>
      <TimezoneInput label="Time zone" name="zone" />
      <FormHelperText>Times on your schedule are shown in this zone.</FormHelperText>
    </FormControl>
  )
}
