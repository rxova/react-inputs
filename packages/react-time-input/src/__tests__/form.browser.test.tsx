import { describe, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { Controller, useForm } from 'react-hook-form'
import { Form, Formik, useField } from 'formik'
import { Field as FinalField, Form as FinalForm } from 'react-final-form'
import { useForm as useTanstackForm } from '@tanstack/react-form'
import { TimeInput } from '../TimeInput'

/**
 * The whole loop for each integration: type → library state updates → submit
 * produces the right payload.
 *
 * Two things are being pinned. The value a form stores is 24-hour `HH:mm` even
 * when the field displays `9:30 AM`, so what is stored can be compared and
 * sorted without knowing which locale produced it. And `onChange` fires only
 * once the time is complete, so a library never sees `09:` as an intermediate
 * value it might validate.
 */
function firstSegment(): HTMLElement {
  return document.querySelector<HTMLElement>('[data-rx-time-segment]')!
}

/** Type a full 24-hour time: hour then minute. */
async function typeTime(digits = '0930') {
  firstSegment().focus()
  await userEvent.keyboard(digits)
}

describe('native form, no library', () => {
  it('posts the 24-hour value under its name, whatever the field displays', async () => {
    const onSubmit = vi.fn()
    await render(
      <form
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit(Object.fromEntries(new FormData(event.currentTarget)))
        }}
      >
        <TimeInput name="start" label="Start" locale="en-GB" />
        <button type="submit">Save</button>
      </form>,
    )
    await typeTime()
    await page.getByRole('button', { name: 'Save' }).click()

    expect(onSubmit).toHaveBeenCalledWith({ start: '09:30' })
  })
})

describe('react-hook-form via Controller', () => {
  function Harness({ onValid }: { onValid: (value: unknown) => void }) {
    const { control, handleSubmit } = useForm<{ start: string | null }>({
      defaultValues: { start: null },
    })
    return (
      <form
        onSubmit={(event) => {
          void handleSubmit(onValid)(event)
        }}
      >
        <Controller
          name="start"
          control={control}
          render={({ field }) => (
            <TimeInput
              label="Start"
              locale="en-GB"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
            />
          )}
        />
        <button type="submit">Save</button>
      </form>
    )
  }

  it('binds the 24-hour string and submits it', async () => {
    const onValid = vi.fn()
    await render(<Harness onValid={onValid} />)
    await typeTime()
    await page.getByRole('button', { name: 'Save' }).click()

    await vi.waitFor(() => {
      expect(onValid).toHaveBeenCalledWith({ start: '09:30' }, expect.anything())
    })
  })
})

describe('formik via useField', () => {
  function Field() {
    const [field, meta, helpers] = useField<string | null>('start')
    return (
      <>
        <TimeInput
          label="Start"
          name="start"
          locale="en-GB"
          value={field.value}
          onChange={(value) => void helpers.setValue(value)}
          onBlur={() => void helpers.setTouched(true)}
        />
        <output data-testid="touched">{String(meta.touched)}</output>
      </>
    )
  }

  it('drives Formik state and submits the 24-hour string', async () => {
    const onSubmit = vi.fn()
    await render(
      <Formik initialValues={{ start: null }} onSubmit={(values) => onSubmit(values)}>
        <Form>
          <Field />
          <button type="submit">Save</button>
        </Form>
      </Formik>,
    )
    await typeTime()
    await page.getByRole('button', { name: 'Save' }).click()

    await vi.waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ start: '09:30' })
    })
  })

  it('marks touched when focus leaves the field, not when it moves between segments', async () => {
    // Two segments, one field. Marking it touched on the way from hour to
    // minute would show "required" while the user is still typing the time.
    await render(
      <Formik initialValues={{ start: null }} onSubmit={() => undefined}>
        <Form>
          <Field />
          <button type="submit">Save</button>
        </Form>
      </Formik>,
    )
    firstSegment().focus()
    await userEvent.keyboard('09')

    await expect.element(page.getByTestId('touched')).toHaveTextContent('false')

    await page.getByRole('button', { name: 'Save' }).click()

    await expect.element(page.getByTestId('touched')).toHaveTextContent('true')
  })
})

describe('react-final-form via Field', () => {
  it('binds the field and submits the 24-hour string', async () => {
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
            <FinalField name="start">
              {({ input }) => (
                <TimeInput
                  label="Start"
                  locale="en-GB"
                  name={input.name}
                  // RFF starts a field as `''`; the component takes `null` for
                  // empty, and treats the two the same way on the way in.
                  value={input.value === '' ? null : String(input.value)}
                  onChange={input.onChange}
                  onBlur={input.onBlur}
                />
              )}
            </FinalField>
            <button type="submit">Save</button>
          </form>
        )}
      />,
    )
    await typeTime()
    await page.getByRole('button', { name: 'Save' }).click()

    await vi.waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ start: '09:30' })
    })
  })
})

describe('TanStack Form via form.Field', () => {
  function Harness({ onValid }: { onValid: (value: unknown) => void }) {
    const form = useTanstackForm({
      defaultValues: { start: null as string | null },
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
        <form.Field name="start">
          {(field) => (
            <TimeInput
              label="Start"
              name="start"
              locale="en-GB"
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

  it('binds the 24-hour string and submits it', async () => {
    const onValid = vi.fn()
    await render(<Harness onValid={onValid} />)
    await typeTime()
    await page.getByRole('button', { name: 'Save' }).click()

    await vi.waitFor(() => {
      expect(onValid).toHaveBeenCalledWith({ start: '09:30' })
    })
  })
})
