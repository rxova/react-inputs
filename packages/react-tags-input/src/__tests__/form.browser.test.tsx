import { describe, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { Controller, useForm } from 'react-hook-form'
import { Form, Formik, useField } from 'formik'
import { Field as FinalField, Form as FinalForm } from 'react-final-form'
import { useForm as useTanstackForm } from '@tanstack/react-form'
import { TagsInput } from '../TagsInput'

/**
 * The whole loop for each integration: type → library state updates → submit
 * produces the right payload.
 *
 * The value is a `string[]`, and a native submit emits one hidden input per tag
 * rather than a joined string — so `formData.getAll('skills')` is an array and
 * nobody downstream has to guess which separator was used, or what happens to a
 * tag containing that separator.
 */
function box(): HTMLInputElement {
  return document.querySelector<HTMLInputElement>('[data-rx-tags-input]')!
}

async function typeTags(...tags: string[]) {
  box().focus()
  for (const tag of tags) await userEvent.keyboard(`${tag}{Enter}`)
}

describe('native form, no library', () => {
  it('posts one field per tag, so getAll returns an array', async () => {
    const onSubmit = vi.fn()
    await render(
      <form
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit(new FormData(event.currentTarget).getAll('skills'))
        }}
      >
        <TagsInput name="skills" label="Skills" />
        <button type="submit">Save</button>
      </form>,
    )
    await typeTags('react', 'a11y')
    await page.getByRole('button', { name: 'Save' }).click()

    expect(onSubmit).toHaveBeenCalledWith(['react', 'a11y'])
  })
})

describe('react-hook-form via Controller', () => {
  function Harness({ onValid }: { onValid: (value: unknown) => void }) {
    const { control, handleSubmit } = useForm<{ skills: string[] }>({
      defaultValues: { skills: [] },
    })
    return (
      <form
        onSubmit={(event) => {
          void handleSubmit(onValid)(event)
        }}
      >
        <Controller
          name="skills"
          control={control}
          render={({ field }) => (
            <TagsInput
              label="Skills"
              value={field.value}
              onChange={field.onChange}
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

  it('binds the array and submits it', async () => {
    const onValid = vi.fn()
    await render(<Harness onValid={onValid} />)
    await typeTags('react', 'vue')
    await page.getByRole('button', { name: 'Save' }).click()

    await vi.waitFor(() => {
      expect(onValid).toHaveBeenCalledWith({ skills: ['react', 'vue'] }, expect.anything())
    })
  })
})

describe('formik via useField', () => {
  function Field() {
    const [field, meta, helpers] = useField<string[]>('skills')
    return (
      <>
        <TagsInput
          label="Skills"
          name="skills"
          value={field.value}
          onChange={(tags) => void helpers.setValue(tags)}
          onBlur={() => void helpers.setTouched(true)}
        />
        <output data-testid="touched">{String(meta.touched)}</output>
      </>
    )
  }

  it('drives Formik state and submits the array', async () => {
    const onSubmit = vi.fn()
    await render(
      <Formik initialValues={{ skills: [] }} onSubmit={(values) => onSubmit(values)}>
        <Form>
          <Field />
          <button type="submit">Save</button>
        </Form>
      </Formik>,
    )
    await typeTags('react')
    await page.getByRole('button', { name: 'Save' }).click()

    await vi.waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ skills: ['react'] })
    })
  })

  it('marks touched when focus leaves the field, not when it moves onto a tag', async () => {
    // The remove buttons are inside the field and hold the roving tab stop.
    // Marking the field touched when focus lands on one would fire an error
    // while the user is navigating what they have already entered.
    await render(
      <Formik initialValues={{ skills: [] }} onSubmit={() => undefined}>
        <Form>
          <Field />
          <button type="submit">Save</button>
        </Form>
      </Formik>,
    )
    await typeTags('react')
    document.querySelector<HTMLButtonElement>('[data-rx-tags-remove]')!.focus()

    await expect.element(page.getByTestId('touched')).toHaveTextContent('false')

    await page.getByRole('button', { name: 'Save' }).click()

    await expect.element(page.getByTestId('touched')).toHaveTextContent('true')
  })
})

describe('react-final-form via Field', () => {
  it('binds the field and submits the array', async () => {
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
            <FinalField name="skills">
              {({ input }) => (
                <TagsInput
                  label="Skills"
                  name={input.name}
                  // RFF starts a field as `''`, which is not an array — the
                  // guard is the binding's job, not the component's.
                  value={Array.isArray(input.value) ? (input.value as string[]) : []}
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
    await typeTags('react', 'a11y')
    await page.getByRole('button', { name: 'Save' }).click()

    await vi.waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ skills: ['react', 'a11y'] })
    })
  })
})

describe('TanStack Form via form.Field', () => {
  function Harness({ onValid }: { onValid: (value: unknown) => void }) {
    const form = useTanstackForm({
      defaultValues: { skills: [] as string[] },
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
        <form.Field name="skills">
          {(field) => (
            <TagsInput
              label="Skills"
              name="skills"
              value={field.state.value}
              onChange={(tags) => {
                field.handleChange(tags)
              }}
              onBlur={field.handleBlur}
            />
          )}
        </form.Field>
        <button type="submit">Save</button>
      </form>
    )
  }

  it('binds the array and submits it', async () => {
    const onValid = vi.fn()
    await render(<Harness onValid={onValid} />)
    await typeTags('react', 'vue')
    await page.getByRole('button', { name: 'Save' }).click()

    await vi.waitFor(() => {
      expect(onValid).toHaveBeenCalledWith({ skills: ['react', 'vue'] })
    })
  })
})
