'use client'

import { PasswordField } from '@/components/rxova/password-field'

export function ShadcnPassword() {
  return (
    <PasswordField
      label="Password"
      description="Use at least eight characters."
      name="password"
      showStrength
    />
  )
}
