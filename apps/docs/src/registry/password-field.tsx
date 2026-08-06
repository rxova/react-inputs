'use client'

import { useId } from 'react'
import { PasswordInput, type PasswordInputProps } from '@rxova/react-password-input'

import './password-field.css'

export interface PasswordFieldProps extends Omit<
  PasswordInputProps,
  'label' | 'aria-label' | 'aria-describedby' | 'invalid'
> {
  label: string
  description?: string
  error?: string
}

/** A labelled password field copied into the consumer by the Rxova registry. */
export function PasswordField({ label, description, error, id, ...props }: PasswordFieldProps) {
  const generated = useId()
  const fieldId = id ?? generated
  const describedBy = [description && `${fieldId}-description`, error && `${fieldId}-error`]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="rx-field" data-invalid={error ? '' : undefined}>
      <label className="rx-field__label" htmlFor={`${fieldId}-input`}>
        {label}
      </label>
      <PasswordInput
        {...props}
        id={fieldId}
        label={label}
        invalid={Boolean(error)}
        aria-describedby={describedBy || undefined}
      />
      {description ? (
        <p className="rx-field__description" id={`${fieldId}-description`}>
          {description}
        </p>
      ) : null}
      {error ? (
        <p className="rx-field__error" id={`${fieldId}-error`} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
