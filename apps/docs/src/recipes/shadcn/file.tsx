'use client'

import { FileField } from '@/components/rxova/file-field'

export function ShadcnFile() {
  return (
    <FileField
      label="Attachments"
      description="Choose one or more files."
      name="attachments"
      multiple
    />
  )
}
