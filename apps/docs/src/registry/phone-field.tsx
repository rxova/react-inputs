'use client'

import { useId } from 'react'
import { PhoneInput, type PhoneInputProps } from '@rxova/react-phone-input'

import './phone-field.css'

export interface PhoneFieldProps extends Omit<
  PhoneInputProps,
  'label' | 'aria-label' | 'aria-describedby' | 'invalid'
> {
  label: string
  description?: string
  error?: string
}

/** A labelled phone field copied into the consumer by the Rxova registry. */
export function PhoneField({ label, description, error, id, ...props }: PhoneFieldProps) {
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
      <PhoneInput
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
