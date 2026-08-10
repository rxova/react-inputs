'use client'

import FormControl from '@mui/material/FormControl'
import FormHelperText from '@mui/material/FormHelperText'
import FormLabel from '@mui/material/FormLabel'
import { MeasurementInput } from '@rxova/react-measurement-input'

export function MuiMeasurement() {
  return (
    <FormControl>
      <FormLabel>Height</FormLabel>
      <MeasurementInput label="Height" name="height" units={['foot', 'inch']} />
      <FormHelperText>Feet and inches, or switch the units.</FormHelperText>
    </FormControl>
  )
}
