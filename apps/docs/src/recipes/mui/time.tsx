'use client'

import FormControl from '@mui/material/FormControl'
import FormHelperText from '@mui/material/FormHelperText'
import FormLabel from '@mui/material/FormLabel'
import { TimeInput } from '@rxova/react-time-input'

export function MuiTime() {
  return (
    <FormControl>
      <FormLabel>Start time</FormLabel>
      <TimeInput label="Start time" name="startTime" locale="en-US" />
      <FormHelperText>Enter a local time.</FormHelperText>
    </FormControl>
  )
}
