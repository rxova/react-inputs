'use client'

/**
 * A labelled date field, ready to drop into a form.
 *
 * Distributed through the registry at /r/date-field.json, so `shadcn add` copies
 * this file into your project and you own it from there. The component itself
 * stays an npm dependency — this is the wiring around it (label, description,
 * error, ids), which is the part every project ends up writing by hand and the
 * part that is genuinely yours to change.
 */
import { useId } from 'react'
import { DateInput, type DateInputProps } from '@rxova/react-date-input'

import './date-field.css'

export interface DateInputFieldProps extends DateInputProps {
  /** Visible label. Also the accessible name — do not pass `label` as well. */
  children?: React.ReactNode
  /** Helper text under the field. Announced via `aria-describedby`. */
  description?: string
  /** Error text. Its presence is what marks the field invalid. */
  error?: string
}

export function DateInputField({
  children,
  description,
  error,
  id,
  ...props
}: DateInputFieldProps) {
  const generated = useId()
  const fieldId = id ?? generated
  const describedBy = [description && `${fieldId}-description`, error && `${fieldId}-error`]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="rx-field" data-invalid={error ? '' : undefined}>
      {children ? (
        // A real `<label htmlFor>`: each segment is a spinbutton with an id derived
        // from this one, and the day segment is where entry starts.
        <label className="rx-field__label" htmlFor={`${fieldId}-day`}>
          {children}
        </label>
      ) : null}

      <DateInput
        {...props}
        id={fieldId}
        invalid={Boolean(error)}
        aria-label={typeof children === 'string' ? children : undefined}
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
