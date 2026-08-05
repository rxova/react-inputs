import { describe, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { Controller, useForm } from 'react-hook-form'
import { Form, Formik, useField } from 'formik'
import { Field as FinalField, Form as FinalForm } from 'react-final-form'
import { useForm as useTanstackForm } from '@tanstack/react-form'
import { PasswordInput } from '../PasswordInput'

/**
 * The whole loop for each integration: type → library state updates → submit
 * produces the right payload. This is why `onChange` emits a string rather than
 * an event, why `name` posts natively, and why `onBlur` fires once for the whole
 * field rather than once per element inside it.
 *
 * The blur case is the one worth watching here: this field contains a reveal
 * toggle, so "the user left the field" and "the input lost focus" are different
 * events. A form library that marks the field touched on the second one marks it
 * touched the moment someone clicks the eye.
 */
function box(): HTMLInputElement {
  return document.querySelector<HTMLInputElement>('[data-rx-password-input]')!
}

describe('native form, no library', () => {
  it('posts the password under its name', async () => {
    const onSubmit = vi.fn()
    await render(
      <form
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit(Object.fromEntries(new FormData(event.currentTarget)))
        }}
      >
        <PasswordInput name="password" label="Password" />
        <button type="submit">Sign in</button>
      </form>,
    )
    box().focus()
    await userEvent.keyboard('hunter2hunter2')
    await page.getByRole('button', { name: 'Sign in' }).click()

    expect(onSubmit).toHaveBeenCalledWith({ password: 'hunter2hunter2' })
  })
})

describe('react-hook-form via Controller', () => {
  function Harness({ onValid }: { onValid: (value: unknown) => void }) {
    const { control, handleSubmit } = useForm<{ password: string }>({
      defaultValues: { password: '' },
    })
    return (
      <form
        onSubmit={(event) => {
          void handleSubmit(onValid)(event)
        }}
      >
        <Controller
          name="password"
          control={control}
          render={({ field }) => (
            <PasswordInput
              label="Password"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              ref={field.ref}
            />
          )}
        />
        <button type="submit">Sign in</button>
      </form>
    )
  }

  it('binds the value and submits it', async () => {
    const onValid = vi.fn()
    await render(<Harness onValid={onValid} />)
    box().focus()
    await userEvent.keyboard('correct horse')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await vi.waitFor(() => {
      expect(onValid).toHaveBeenCalledWith({ password: 'correct horse' }, expect.anything())
    })
  })
})

describe('formik via useField', () => {
  function Field() {
    const [field, meta, helpers] = useField<string>('password')
    return (
      <>
        <PasswordInput
          label="Password"
          name="password"
          value={field.value}
          onChange={(value) => void helpers.setValue(value)}
          onBlur={() => void helpers.setTouched(true)}
        />
        <output data-testid="touched">{String(meta.touched)}</output>
      </>
    )
  }

  it('drives Formik state and submits the value', async () => {
    const onSubmit = vi.fn()
    await render(
      <Formik initialValues={{ password: '' }} onSubmit={(values) => onSubmit(values)}>
        <Form>
          <Field />
          <button type="submit">Sign in</button>
        </Form>
      </Formik>,
    )
    box().focus()
    await userEvent.keyboard('staple battery')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await vi.waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ password: 'staple battery' })
    })
  })

  it('marks touched only once focus leaves the field, not on the reveal toggle', async () => {
    // The toggle lives inside the field. Marking the field touched when someone
    // reveals what they typed would show "required" errors mid-entry.
    await render(
      <Formik initialValues={{ password: '' }} onSubmit={() => undefined}>
        <Form>
          <Field />
          <button type="submit">Sign in</button>
        </Form>
      </Formik>,
    )
    box().focus()
    document.querySelector<HTMLButtonElement>('[data-rx-password-toggle]')!.focus()

    await expect.element(page.getByTestId('touched')).toHaveTextContent('false')

    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect.element(page.getByTestId('touched')).toHaveTextContent('true')
  })
})

describe('react-final-form via Field', () => {
  it('binds the field and submits the password', async () => {
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
            <FinalField name="password">
              {({ input }) => (
                <PasswordInput
                  label="Password"
                  name={input.name}
                  value={String(input.value)}
                  onChange={input.onChange}
                  onBlur={input.onBlur}
                />
              )}
            </FinalField>
            <button type="submit">Sign in</button>
          </form>
        )}
      />,
    )
    box().focus()
    await userEvent.keyboard('tr0ub4dour')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await vi.waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ password: 'tr0ub4dour' })
    })
  })
})

describe('TanStack Form via form.Field', () => {
  function Harness({ onValid }: { onValid: (value: unknown) => void }) {
    const form = useTanstackForm({
      defaultValues: { password: '' },
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
        <form.Field name="password">
          {(field) => (
            <PasswordInput
              label="Password"
              name="password"
              value={field.state.value}
              onChange={(value) => {
                field.handleChange(value)
              }}
              onBlur={field.handleBlur}
            />
          )}
        </form.Field>
        <button type="submit">Sign in</button>
      </form>
    )
  }

  it('binds the value and submits it', async () => {
    const onValid = vi.fn()
    await render(<Harness onValid={onValid} />)
    box().focus()
    await userEvent.keyboard('passphrase!')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await vi.waitFor(() => {
      expect(onValid).toHaveBeenCalledWith({ password: 'passphrase!' })
    })
  })
})
