'use client'

import { useId } from 'react'
import { CurrencyInput, type CurrencyInputProps } from '@rxova/react-intl-currency-input'

import './currency-field.css'

export interface CurrencyFieldProps extends Omit<
  CurrencyInputProps,
  'aria-label' | 'aria-describedby' | 'invalid'
> {
  /** Visible and accessible label. */
  label: string
  /** Helper text announced with the input. */
  description?: string
  /** Error text; its presence marks the input invalid. */
  error?: string
}

/** A labelled currency field copied into the consumer by the Rxova registry. */
export function CurrencyField({ label, description, error, id, ...props }: CurrencyFieldProps) {
  const generated = useId()
  const fieldId = id ?? generated
  const describedBy = [description && `${fieldId}-description`, error && `${fieldId}-error`]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="rx-field" data-invalid={error ? '' : undefined}>
      <label className="rx-field__label" htmlFor={fieldId}>
        {label}
      </label>
      <CurrencyInput
        {...props}
        id={fieldId}
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
