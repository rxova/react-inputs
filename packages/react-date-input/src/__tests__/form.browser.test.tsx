import { describe, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { Controller, useForm } from 'react-hook-form'
import { Form, Formik, useField } from 'formik'
import { Field as FinalField, Form as FinalForm } from 'react-final-form'
import { useForm as useTanstackForm } from '@tanstack/react-form'
import { DateInput } from '../DateInput'

/**
 * The whole loop for each integration: type → library state updates → submit
 * produces the right payload.
 *
 * Two things are being pinned. The value a form stores is `YYYY-MM-DD`, never a
 * `Date` and never the locale's display order — an en-GB field and a ja-JP field
 * submit the same string. And `onChange` fires only once the date is complete,
 * so a library never sees `2026-03-` as an intermediate value it might validate.
 */
function firstSegment(): HTMLElement {
  return document.querySelector<HTMLElement>('[data-rx-date-segment]')!
}

/** Type a full en-GB date: day, month, year, in that order. */
async function typeDate(digits = '15032026') {
  firstSegment().focus()
  await userEvent.keyboard(digits)
}

describe('native form, no library', () => {
  it('posts the ISO value under its name, whatever the locale displays', async () => {
    const onSubmit = vi.fn()
    await render(
      <form
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit(Object.fromEntries(new FormData(event.currentTarget)))
        }}
      >
        <DateInput name="due" label="Due" locale="en-GB" />
        <button type="submit">Save</button>
      </form>,
    )
    await typeDate()
    await page.getByRole('button', { name: 'Save' }).click()

    expect(onSubmit).toHaveBeenCalledWith({ due: '2026-03-15' })
  })
})

describe('react-hook-form via Controller', () => {
  function Harness({ onValid }: { onValid: (value: unknown) => void }) {
    const { control, handleSubmit } = useForm<{ due: string | null }>({
      defaultValues: { due: null },
    })
    return (
      <form
        onSubmit={(event) => {
          void handleSubmit(onValid)(event)
        }}
      >
        <Controller
          name="due"
          control={control}
          render={({ field }) => (
            <DateInput
              label="Due"
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

  it('binds the ISO string and submits it', async () => {
    const onValid = vi.fn()
    await render(<Harness onValid={onValid} />)
    await typeDate()
    await page.getByRole('button', { name: 'Save' }).click()

    await vi.waitFor(() => {
      expect(onValid).toHaveBeenCalledWith({ due: '2026-03-15' }, expect.anything())
    })
  })
})

describe('formik via useField', () => {
  function Field() {
    const [field, meta, helpers] = useField<string | null>('due')
    return (
      <>
        <DateInput
          label="Due"
          name="due"
          locale="en-GB"
          value={field.value}
          onChange={(value) => void helpers.setValue(value)}
          onBlur={() => void helpers.setTouched(true)}
        />
        <output data-testid="touched">{String(meta.touched)}</output>
      </>
    )
  }

  it('drives Formik state and submits the ISO string', async () => {
    const onSubmit = vi.fn()
    await render(
      <Formik initialValues={{ due: null }} onSubmit={(values) => onSubmit(values)}>
        <Form>
          <Field />
          <button type="submit">Save</button>
        </Form>
      </Formik>,
    )
    await typeDate()
    await page.getByRole('button', { name: 'Save' }).click()

    await vi.waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ due: '2026-03-15' })
    })
  })

  it('marks touched when focus leaves the field, not when it moves between segments', async () => {
    // Three segments, one field. Marking it touched on the way from day to
    // month would show "required" while the user is still typing the date.
    await render(
      <Formik initialValues={{ due: null }} onSubmit={() => undefined}>
        <Form>
          <Field />
          <button type="submit">Save</button>
        </Form>
      </Formik>,
    )
    firstSegment().focus()
    await userEvent.keyboard('15')

    await expect.element(page.getByTestId('touched')).toHaveTextContent('false')

    await page.getByRole('button', { name: 'Save' }).click()

    await expect.element(page.getByTestId('touched')).toHaveTextContent('true')
  })
})

describe('react-final-form via Field', () => {
  it('binds the field and submits the ISO string', async () => {
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
            <FinalField name="due">
              {({ input }) => (
                <DateInput
                  label="Due"
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
    await typeDate()
    await page.getByRole('button', { name: 'Save' }).click()

    await vi.waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ due: '2026-03-15' })
    })
  })
})

describe('TanStack Form via form.Field', () => {
  function Harness({ onValid }: { onValid: (value: unknown) => void }) {
    const form = useTanstackForm({
      defaultValues: { due: null as string | null },
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
        <form.Field name="due">
          {(field) => (
            <DateInput
              label="Due"
              name="due"
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

  it('binds the ISO string and submits it', async () => {
    const onValid = vi.fn()
    await render(<Harness onValid={onValid} />)
    await typeDate()
    await page.getByRole('button', { name: 'Save' }).click()

    await vi.waitFor(() => {
      expect(onValid).toHaveBeenCalledWith({ due: '2026-03-15' })
    })
  })
})
