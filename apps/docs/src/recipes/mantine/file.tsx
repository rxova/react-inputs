'use client'

import { Input } from '@mantine/core'
import { FileInput } from '@rxova/react-file-input'

export function MantineFile() {
  return (
    <Input.Wrapper label="Attachments" description="Choose one or more files.">
      <FileInput label="Attachments" name="attachments" multiple />
    </Input.Wrapper>
  )
}
