import { describe, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { Controller, useForm } from 'react-hook-form'
import { Form, Formik, useField } from 'formik'
import { Field as FinalField, Form as FinalForm } from 'react-final-form'
import { useForm as useTanstackForm } from '@tanstack/react-form'
import { PhoneInput } from '../PhoneInput'

/**
 * The whole loop for each integration: type → library state updates → submit
 * produces the right payload.
 *
 * The payload is the point. `onChange` hands the library E.164 and keeps the
 * formatted text to itself, so what a form stores is `+442071234567` no matter
 * which country produced it or how the field chose to group the digits. A field
 * that stored its own display text would make the grouping a database concern.
 */
function box(): HTMLInputElement {
  return document.querySelector<HTMLInputElement>('[data-rx-phone-input]')!
}

describe('native form, no library', () => {
  it('posts E.164 under its name, not the formatted text', async () => {
    const onSubmit = vi.fn()
    await render(
      <form
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit(Object.fromEntries(new FormData(event.currentTarget)))
        }}
      >
        <PhoneInput name="phone" label="Phone" defaultCountry="GB" />
        <button type="submit">Save</button>
      </form>,
    )
    box().focus()
    await userEvent.keyboard('2071234567')
    await page.getByRole('button', { name: 'Save' }).click()

    expect(onSubmit).toHaveBeenCalledWith({ phone: '+442071234567' })
  })
})

describe('react-hook-form via Controller', () => {
  function Harness({ onValid }: { onValid: (value: unknown) => void }) {
    const { control, handleSubmit } = useForm<{ phone: string }>({ defaultValues: { phone: '' } })
    return (
      <form
        onSubmit={(event) => {
          void handleSubmit(onValid)(event)
        }}
      >
        <Controller
          name="phone"
          control={control}
          render={({ field }) => (
            <PhoneInput
              label="Phone"
              defaultCountry="US"
              value={field.value}
              // The second argument is the details object; RHF wants the value
              // alone, so this cannot be `field.onChange` passed by reference.
              onChange={(value) => {
                field.onChange(value)
              }}
              onBlur={field.onBlur}
              name={field.name}
              ref={field.ref}
            />
          )}
        />
        <button type="submit">Save</button>
      </form>
    )
  }

  it('binds E.164 and submits it', async () => {
    const onValid = vi.fn()
    await render(<Harness onValid={onValid} />)
    box().focus()
    await userEvent.keyboard('4155552671')
    await page.getByRole('button', { name: 'Save' }).click()

    await vi.waitFor(() => {
      expect(onValid).toHaveBeenCalledWith({ phone: '+14155552671' }, expect.anything())
    })
  })
})

describe('formik via useField', () => {
  function Field() {
    const [field, meta, helpers] = useField<string>('phone')
    return (
      <>
        <PhoneInput
          label="Phone"
          name="phone"
          defaultCountry="GB"
          value={field.value}
          onChange={(value) => void helpers.setValue(value)}
          onBlur={() => void helpers.setTouched(true)}
        />
        <output data-testid="touched">{String(meta.touched)}</output>
      </>
    )
  }

  it('drives Formik state and submits E.164', async () => {
    const onSubmit = vi.fn()
    await render(
      <Formik initialValues={{ phone: '' }} onSubmit={(values) => onSubmit(values)}>
        <Form>
          <Field />
          <button type="submit">Save</button>
        </Form>
      </Formik>,
    )
    box().focus()
    await userEvent.keyboard('2071234567')
    await page.getByRole('button', { name: 'Save' }).click()

    await vi.waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ phone: '+442071234567' })
    })
  })

  it('marks touched only once focus leaves the field, not on the country select', async () => {
    // The select is inside the field. Marking the field touched when someone
    // picks their country would show "required" before they have typed a digit.
    await render(
      <Formik initialValues={{ phone: '' }} onSubmit={() => undefined}>
        <Form>
          <Field />
          <button type="submit">Save</button>
        </Form>
      </Formik>,
    )
    box().focus()
    document.querySelector<HTMLSelectElement>('[data-rx-phone-country]')!.focus()

    await expect.element(page.getByTestId('touched')).toHaveTextContent('false')

    await page.getByRole('button', { name: 'Save' }).click()

    await expect.element(page.getByTestId('touched')).toHaveTextContent('true')
  })
})

describe('react-final-form via Field', () => {
  it('binds the field and submits E.164', async () => {
    const onSubmit = vi.fn()
    await render(
      <FinalForm
        onSubmit={(values) => {
          onSubmit(values)
        }}
        render={({ handleSubmit }) => (
          <form
            onSubmit={(event) => {
              void handleSubmit(event)
            }}
          >
            <FinalField name="phone">
              {({ input }) => (
                <PhoneInput
                  label="Phone"
                  name={input.name}
                  defaultCountry="GB"
                  value={String(input.value)}
                  onChange={(value) => {
                    input.onChange(value)
                  }}
                  onBlur={input.onBlur}
                />
              )}
            </FinalField>
            <button type="submit">Save</button>
          </form>
        )}
      />,
    )
    box().focus()
    await userEvent.keyboard('2071234567')
    await page.getByRole('button', { name: 'Save' }).click()

    await vi.waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ phone: '+442071234567' })
    })
  })
})

describe('TanStack Form via form.Field', () => {
  function Harness({ onValid }: { onValid: (value: unknown) => void }) {
    const form = useTanstackForm({
      defaultValues: { phone: '' },
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
        <form.Field name="phone">
          {(field) => (
            <PhoneInput
              label="Phone"
              name="phone"
              defaultCountry="US"
              value={field.state.value}
              onChange={(value) => {
                field.handleChange(value)
              }}
              onBlur={field.handleBlur}
            />
          )}
        </form.Field>
        <button type="submit">Save</button>
      </form>
    )
  }

  it('binds E.164 and submits it', async () => {
    const onValid = vi.fn()
    await render(<Harness onValid={onValid} />)
    box().focus()
    await userEvent.keyboard('4155552671')
    await page.getByRole('button', { name: 'Save' }).click()

    await vi.waitFor(() => {
      expect(onValid).toHaveBeenCalledWith({ phone: '+14155552671' })
    })
  })
})
