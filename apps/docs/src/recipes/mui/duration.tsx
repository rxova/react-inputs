'use client'

import FormControl from '@mui/material/FormControl'
import FormHelperText from '@mui/material/FormHelperText'
import FormLabel from '@mui/material/FormLabel'
import { DurationInput } from '@rxova/react-duration-input'

export function MuiDuration() {
  return (
    <FormControl>
      <FormLabel>Estimate</FormLabel>
      <DurationInput label="Estimate" name="estimate" units={['hour', 'minute']} />
      <FormHelperText>How long the task should take.</FormHelperText>
    </FormControl>
  )
}
