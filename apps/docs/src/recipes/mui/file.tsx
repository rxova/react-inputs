'use client'

import FormControl from '@mui/material/FormControl'
import FormHelperText from '@mui/material/FormHelperText'
import FormLabel from '@mui/material/FormLabel'
import { FileInput } from '@rxova/react-file-input'

export function MuiFile() {
  return (
    <FormControl>
      <FormLabel>Attachments</FormLabel>
      <FileInput label="Attachments" name="attachments" multiple />
      <FormHelperText>Choose one or more files.</FormHelperText>
    </FormControl>
  )
}
