'use client'

import { useId } from 'react'
import { TimeInput, type TimeInputProps } from '@rxova/react-time-input'

import './time-field.css'

export interface TimeFieldProps extends Omit<
  TimeInputProps,
  'label' | 'aria-describedby' | 'invalid'
> {
  label: string
  description?: string
  error?: string
}

/** A labelled segmented time field copied into the consumer by the Rxova registry. */
export function TimeField({ label, description, error, id, ...props }: TimeFieldProps) {
  const generated = useId()
  const fieldId = id ?? generated
  const describedBy = [description && `${fieldId}-description`, error && `${fieldId}-error`]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="rx-field" data-invalid={error ? '' : undefined}>
      <span className="rx-field__label">{label}</span>
      <TimeInput
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
