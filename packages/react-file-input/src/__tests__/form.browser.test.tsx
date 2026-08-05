import { describe, expect, it, vi } from 'vitest'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { Controller, useForm } from 'react-hook-form'
import { Form, Formik, useField } from 'formik'
import { Field as FinalField, Form as FinalForm } from 'react-final-form'
import { useForm as useTanstackForm } from '@tanstack/react-form'
import { FileInput } from '../FileInput'

/**
 * The whole loop for each integration: pick → library state updates → submit
 * produces the right payload.
 *
 * The value is `File[]`, and the native path posts the real `<input type=file>`
 * rather than a serialised stand-in — which is why the input is visually hidden
 * instead of absent. Nothing here uploads: the component hands over `File`
 * objects and the transport stays the caller's.
 */
function makeFile(name: string, type = 'text/plain') {
  return new File([new Uint8Array(8)], name, { type, lastModified: 1_700_000_000_000 })
}

function input(): HTMLInputElement {
  return document.querySelector<HTMLInputElement>('[data-rx-file-input]')!
}

/** Drive the hidden input the way the native picker does. */
function pick(...files: File[]) {
  const data = new DataTransfer()
  for (const file of files) data.items.add(file)
  const element = input()
  element.files = data.files
  element.dispatchEvent(new Event('change', { bubbles: true }))
}

describe('native form, no library', () => {
  it('posts the real files, not a stand-in for them', async () => {
    const onSubmit = vi.fn<(files: File[]) => void>()
    await render(
      <form
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit(new FormData(event.currentTarget).getAll('docs') as File[])
        }}
      >
        <FileInput name="docs" label="Documents" multiple />
        <button type="submit">Upload</button>
      </form>,
    )
    pick(makeFile('a.txt'), makeFile('b.txt'))
    await page.getByRole('button', { name: 'Upload' }).click()

    const posted = onSubmit.mock.calls[0]?.[0] ?? []
    expect(posted.map((file) => file.name)).toEqual(['a.txt', 'b.txt'])
    expect(posted[0]).toBeInstanceOf(File)
  })
})

describe('react-hook-form via Controller', () => {
  function Harness({ onValid }: { onValid: (value: unknown) => void }) {
    const { control, handleSubmit } = useForm<{ docs: File[] }>({ defaultValues: { docs: [] } })
    return (
      <form
        onSubmit={(event) => {
          void handleSubmit(onValid)(event)
        }}
      >
        <Controller
          name="docs"
          control={control}
          render={({ field }) => (
            <FileInput
              label="Documents"
              multiple
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              ref={field.ref}
            />
          )}
        />
        <button type="submit">Upload</button>
      </form>
    )
  }

  it('binds the File array and submits it', async () => {
    const onValid = vi.fn()
    await render(<Harness onValid={onValid} />)
    pick(makeFile('report.pdf', 'application/pdf'))
    await page.getByRole('button', { name: 'Upload' }).click()

    await vi.waitFor(() => {
      expect(onValid).toHaveBeenCalledWith(
        { docs: [expect.objectContaining({ name: 'report.pdf' })] },
        expect.anything(),
      )
    })
  })
})

describe('formik via useField', () => {
  function Field() {
    const [field, meta, helpers] = useField<File[]>('docs')
    return (
      <>
        <FileInput
          label="Documents"
          name="docs"
          multiple
          value={field.value}
          onChange={(files) => void helpers.setValue(files)}
          onBlur={() => void helpers.setTouched(true)}
        />
        <output data-testid="touched">{String(meta.touched)}</output>
      </>
    )
  }

  it('drives Formik state and submits the files', async () => {
    const onSubmit = vi.fn<(values: { docs: File[] }) => void>()
    await render(
      <Formik initialValues={{ docs: [] as File[] }} onSubmit={(values) => onSubmit(values)}>
        <Form>
          <Field />
          <button type="submit">Upload</button>
        </Form>
      </Formik>,
    )
    pick(makeFile('notes.txt'))
    await page.getByRole('button', { name: 'Upload' }).click()

    await vi.waitFor(() => {
      expect(onSubmit.mock.calls[0]?.[0].docs.map((file) => file.name)).toEqual(['notes.txt'])
    })
  })

  it('marks touched when focus leaves the field, not when it moves to a remove button', async () => {
    // The drop zone and every remove button are inside the field. Marking it
    // touched when focus lands on one would show an error while the user is
    // still curating the selection.
    await render(
      <Formik initialValues={{ docs: [] as File[] }} onSubmit={() => undefined}>
        <Form>
          <Field />
          <button type="submit">Upload</button>
        </Form>
      </Formik>,
    )
    pick(makeFile('notes.txt'))
    document.querySelector<HTMLButtonElement>('[data-rx-file-zone]')!.focus()
    document.querySelector<HTMLButtonElement>('[data-rx-file-remove]')!.focus()

    await expect.element(page.getByTestId('touched')).toHaveTextContent('false')

    await page.getByRole('button', { name: 'Upload' }).click()

    await expect.element(page.getByTestId('touched')).toHaveTextContent('true')
  })
})

describe('react-final-form via Field', () => {
  it('binds the field and submits the files', async () => {
    const onSubmit = vi.fn<(values: { docs: File[] }) => void>()
    await render(
      <FinalForm
        onSubmit={(values) => {
          onSubmit(values as { docs: File[] })
        }}
        render={({ handleSubmit }) => (
          <form
            onSubmit={(event) => {
              void handleSubmit(event)
            }}
          >
            <FinalField name="docs">
              {({ input: field }) => (
                <FileInput
                  label="Documents"
                  name={field.name}
                  multiple
                  // RFF starts a field as `''`, which is not an array — the
                  // guard is the binding's job, not the component's.
                  value={Array.isArray(field.value) ? (field.value as File[]) : []}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                />
              )}
            </FinalField>
            <button type="submit">Upload</button>
          </form>
        )}
      />,
    )
    pick(makeFile('scan.png', 'image/png'))
    await page.getByRole('button', { name: 'Upload' }).click()

    await vi.waitFor(() => {
      expect(onSubmit.mock.calls[0]?.[0].docs.map((file) => file.name)).toEqual(['scan.png'])
    })
  })
})

describe('TanStack Form via form.Field', () => {
  function Harness({ onValid }: { onValid: (value: { docs: File[] }) => void }) {
    const form = useTanstackForm({
      defaultValues: { docs: [] as File[] },
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
        <form.Field name="docs">
          {(field) => (
            <FileInput
              label="Documents"
              name="docs"
              multiple
              value={field.state.value}
              onChange={(files) => {
                field.handleChange(files)
              }}
              onBlur={field.handleBlur}
            />
          )}
        </form.Field>
        <button type="submit">Upload</button>
      </form>
    )
  }

  it('binds the File array and submits it', async () => {
    const onValid = vi.fn<(value: { docs: File[] }) => void>()
    await render(<Harness onValid={onValid} />)
    pick(makeFile('a.txt'), makeFile('b.txt'))
    await page.getByRole('button', { name: 'Upload' }).click()

    await vi.waitFor(() => {
      expect(onValid.mock.calls[0]?.[0].docs.map((file) => file.name)).toEqual(['a.txt', 'b.txt'])
    })
  })
})
