'use client'

import { Field } from '@chakra-ui/react'
import { FileInput } from '@rxova/react-file-input'

export function ChakraFile() {
  return (
    <Field.Root>
      <Field.Label>Attachments</Field.Label>
      <FileInput label="Attachments" name="attachments" multiple />
      <Field.HelperText>Choose one or more files.</Field.HelperText>
    </Field.Root>
  )
}
