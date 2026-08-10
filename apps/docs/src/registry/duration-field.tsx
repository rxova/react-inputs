'use client'

import { useId } from 'react'
import { DurationInput, type DurationInputProps } from '@rxova/react-duration-input'

import './duration-field.css'

export interface DurationFieldProps extends Omit<
  DurationInputProps,
  'label' | 'aria-describedby' | 'invalid'
> {
  label: string
  description?: string
  error?: string
}

/** A labelled segmented duration field copied into the consumer by the Rxova registry. */
export function DurationField({ label, description, error, id, ...props }: DurationFieldProps) {
  const generated = useId()
  const fieldId = id ?? generated
  const describedBy = [description && `${fieldId}-description`, error && `${fieldId}-error`]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="rx-field" data-invalid={error ? '' : undefined}>
      <span className="rx-field__label">{label}</span>
      <DurationInput
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
