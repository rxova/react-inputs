import { describe, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { Controller, useForm } from 'react-hook-form'
import { Formik, Form, useField } from 'formik'
import { Field, Form as RFFForm } from 'react-final-form'
import { useForm as useTanstackForm } from '@tanstack/react-form'
import { SeatMap } from '../SeatMap'
import { parseLayout } from '../layout'

/**
 * These assert the whole loop for each library: interact -> library state
 * updates -> submit produces the right payload -> validation renders. They are
 * the reason `onBlur`, `invalid`, `minSeats` and `aria-describedby` exist as
 * props.
 */

const ROW = parseLayout('12: ###')
const seat = (name: string) => page.getByRole('checkbox', { name })

describe('native form, no library', () => {
  it('submits a real array under one name, not a joined string', async () => {
    // Every competitor is callback-only, so consumers hand-roll hidden inputs
    // and then have to agree on a delimiter. Real checkboxes make `getAll`
    // work with nothing in between.
    const onSubmit = vi.fn()
    await render(
      <form
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit(new FormData(event.currentTarget).getAll('seats'))
        }}
      >
        <SeatMap sections={ROW} name="seats" onChange={() => undefined} label="Seats" />
        <button type="submit">Send</button>
      </form>,
    )
    await seat('12A').click()
    await seat('12C').click()
    await page.getByRole('button', { name: 'Send' }).click()
    expect(onSubmit).toHaveBeenCalledWith(['12A', '12C'])
  })

  it('submits nothing at all when no seat is chosen', async () => {
    const onSubmit = vi.fn()
    await render(
      <form
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit(new FormData(event.currentTarget).getAll('seats'))
        }}
      >
        <SeatMap sections={ROW} name="seats" onChange={() => undefined} label="Seats" />
        <button type="submit">Send</button>
      </form>,
    )
    await page.getByRole('button', { name: 'Send' }).click()
    expect(onSubmit).toHaveBeenCalledWith([])
  })

  it('blocks submission below minSeats using the browser`s own validation', async () => {
    const onSubmit = vi.fn()
    await render(
      <form
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit()
        }}
      >
        <SeatMap
          sections={ROW}
          name="seats"
          minSeats={2}
          onChange={() => undefined}
          label="Seats"
        />
        <button type="submit">Send</button>
      </form>,
    )
    await seat('12A').click()
    await page.getByRole('button', { name: 'Send' }).click()
    expect(onSubmit).not.toHaveBeenCalled()

    await seat('12B').click()
    await page.getByRole('button', { name: 'Send' }).click()
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('carries the reason in the native validation message', async () => {
    const { container } = await render(
      <SeatMap sections={ROW} name="seats" minSeats={2} onChange={() => undefined} label="S" />,
    )
    const first = container.querySelector<HTMLInputElement>('[data-rx-seat-map-seat="12A"]')
    expect(first?.validationMessage).toBe('Choose at least 2 seats.')
  })

  it('takes a validation message formatter', async () => {
    const { container } = await render(
      <SeatMap
        sections={ROW}
        name="seats"
        minSeats={2}
        onChange={() => undefined}
        label="S"
        formatValidationMessage={({ selected, min }) =>
          `${String(selected)} of ${String(min)} chosen`
        }
      />,
    )
    const first = container.querySelector<HTMLInputElement>('[data-rx-seat-map-seat="12A"]')
    expect(first?.validationMessage).toBe('0 of 2 chosen')
  })

  it('treats `required` as a minimum of one', async () => {
    const { container } = await render(
      <SeatMap sections={ROW} name="seats" required onChange={() => undefined} label="S" />,
    )
    const first = container.querySelector<HTMLInputElement>('[data-rx-seat-map-seat="12A"]')
    expect(first?.validationMessage).toBe('Choose at least 1 seat.')
  })

  it('does not hold a read-only map to a minimum it cannot meet', async () => {
    const { container } = await render(<SeatMap sections={ROW} minSeats={2} label="S" />)
    expect(container.querySelector('input')).toBeNull()
  })

  it('resets with the form', async () => {
    await render(
      <form>
        <SeatMap
          sections={ROW}
          name="seats"
          defaultValue={[]}
          onChange={() => undefined}
          label="Seats"
        />
        <button type="reset">Reset</button>
      </form>,
    )
    await seat('12A').click()
    await expect.element(seat('12A')).toBeChecked()
    await page.getByRole('button', { name: 'Reset' }).click()
    await expect.element(seat('12A')).not.toBeChecked()
  })
})

describe('react-hook-form', () => {
  function Harness({ onValid }: { onValid: (values: unknown) => void }) {
    const { control, handleSubmit } = useForm<{ seats: string[] }>({
      defaultValues: { seats: [] },
    })
    return (
      <form
        onSubmit={(event) => {
          void handleSubmit(onValid)(event)
        }}
      >
        <Controller
          name="seats"
          control={control}
          rules={{ validate: (seats) => seats.length > 0 || 'Choose a seat' }}
          render={({ field, fieldState }) => (
            <>
              <SeatMap
                sections={ROW}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                label="Seats"
                invalid={fieldState.invalid}
                aria-describedby={fieldState.error ? 'seat-err' : undefined}
              />
              {fieldState.error ? <p id="seat-err">{fieldState.error.message}</p> : null}
            </>
          )}
        />
        <button type="submit">Send</button>
      </form>
    )
  }

  it('drives the field and submits an array', async () => {
    const onValid = vi.fn()
    await render(<Harness onValid={onValid} />)
    await seat('12B').click()
    await page.getByRole('button', { name: 'Send' }).click()
    await vi.waitFor(() => {
      expect(onValid).toHaveBeenCalledWith({ seats: ['12B'] }, expect.anything())
    })
  })

  it('renders the error and links it to the group', async () => {
    await render(<Harness onValid={vi.fn()} />)
    await page.getByRole('button', { name: 'Send' }).click()
    await expect.element(page.getByText('Choose a seat')).toBeInTheDocument()
    const group = page.getByRole('group', { name: 'Seats' })
    await expect.element(group).toHaveAttribute('aria-describedby', 'seat-err')
    await expect.element(group).toHaveAttribute('aria-invalid', 'true')
  })
})

describe('formik', () => {
  function SeatField() {
    const [field, meta, helpers] = useField<string[]>('seats')
    return (
      <SeatMap
        sections={ROW}
        name="seats"
        value={field.value}
        onChange={(ids) => {
          void helpers.setValue(ids)
        }}
        onBlur={field.onBlur}
        label="Seats"
        invalid={meta.touched && Boolean(meta.error)}
      />
    )
  }

  it('submits through formik state', async () => {
    const onSubmit = vi.fn()
    await render(
      <Formik initialValues={{ seats: [] as string[] }} onSubmit={onSubmit}>
        <Form>
          <SeatField />
          <button type="submit">Send</button>
        </Form>
      </Formik>,
    )
    await seat('12C').click()
    await page.getByRole('button', { name: 'Send' }).click()
    await vi.waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ seats: ['12C'] }, expect.anything())
    })
  })

  it('forwards a blur event whose target carries the field name', async () => {
    // Formik's handleBlur reads event.target.name to identify the field, which
    // only works because the target is a real named checkbox.
    const onBlur = vi.fn()
    await render(
      <>
        <SeatMap
          sections={ROW}
          name="seats"
          onChange={() => undefined}
          onBlur={onBlur}
          label="Seats"
        />
        <button type="button">after</button>
      </>,
    )
    await seat('12A').click()
    await page.getByRole('button', { name: 'after' }).click()
    await vi.waitFor(() => {
      expect(onBlur).toHaveBeenCalledTimes(1)
    })
    const event = onBlur.mock.calls[0]?.[0] as { target: HTMLInputElement }
    expect(event.target.name).toBe('seats')
  })
})

describe('react-final-form', () => {
  it('handles the empty initial value and submits an array', async () => {
    const onSubmit = vi.fn()
    await render(
      <RFFForm
        onSubmit={onSubmit}
        render={({ handleSubmit }) => (
          <form
            onSubmit={(event) => {
              void handleSubmit(event)
            }}
          >
            <Field name="seats">
              {({ input }) => (
                <SeatMap
                  sections={ROW}
                  // RFF represents an empty field as '', which is not an array.
                  value={Array.isArray(input.value) ? (input.value as string[]) : []}
                  onChange={input.onChange}
                  onBlur={input.onBlur}
                  label="Seats"
                />
              )}
            </Field>
            <button type="submit">Send</button>
          </form>
        )}
      />,
    )
    await seat('12A').click()
    await page.getByRole('button', { name: 'Send' }).click()
    await vi.waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ seats: ['12A'] }),
        expect.anything(),
        expect.anything(),
      )
    })
  })
})

describe('tanstack form', () => {
  function Harness({ onValid }: { onValid: (values: { seats: string[] }) => void }) {
    const form = useTanstackForm({
      defaultValues: { seats: [] as string[] },
      onSubmit: ({ value }) => {
        onValid(value)
      },
    })
    return (
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void form.handleSubmit()
        }}
      >
        <form.Field
          name="seats"
          validators={{
            onChange: ({ value }) => (value.length === 0 ? 'Choose a seat' : undefined),
          }}
        >
          {(field) => (
            <SeatMap
              sections={ROW}
              value={field.state.value}
              onChange={(ids) => {
                field.handleChange(ids)
              }}
              onBlur={field.handleBlur}
              label="Seats"
              invalid={!field.state.meta.isValid}
            />
          )}
        </form.Field>
        <button type="submit">Send</button>
      </form>
    )
  }

  it('drives tanstack state and submits the chosen seats', async () => {
    const onValid = vi.fn()
    await render(<Harness onValid={onValid} />)
    await seat('12A').click()
    await seat('12B').click()
    await page.getByRole('button', { name: 'Send' }).click()
    await vi.waitFor(() => {
      expect(onValid).toHaveBeenCalledWith({ seats: ['12A', '12B'] })
    })
  })
})

describe('group blur', () => {
  it('fires once when focus leaves, not while arrowing between seats', async () => {
    const onBlur = vi.fn()
    await render(
      <>
        <SeatMap
          sections={parseLayout('12: ####')}
          onChange={() => undefined}
          onBlur={onBlur}
          label="Seats"
        />
        <button type="button">after</button>
      </>,
    )
    await page.getByRole('checkbox', { name: '12A' }).click()
    await userEvent.keyboard('{ArrowRight}{ArrowRight}')
    expect(onBlur).not.toHaveBeenCalled()

    await page.getByRole('button', { name: 'after' }).click()
    await vi.waitFor(() => {
      expect(onBlur).toHaveBeenCalledTimes(1)
    })
  })
})
