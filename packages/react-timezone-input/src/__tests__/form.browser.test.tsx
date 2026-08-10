import { describe, expect, it, vi } from 'vitest'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { Controller, useForm } from 'react-hook-form'
import { Form, Formik, useField } from 'formik'
import { Field as FinalField, Form as FinalForm } from 'react-final-form'
import { useForm as useTanstackForm } from '@tanstack/react-form'
import { TimezoneInput } from '../TimezoneInput'

/**
 * The whole loop for each integration: choose → library state updates → submit
 * produces the right payload.
 *
 * Two things are being pinned. What a form stores is the IANA id and nothing
 * else — never an offset, which would be right for half the year, and never the
 * `{ value, label, offset }` object every other picker in this category hands
 * back. And the `<select>` carries the `name` itself, so there is no hidden
 * input anywhere in the tree for a binding to fight with.
 */
const ZONES = ['Europe/Madrid', 'America/New_York', 'Asia/Tokyo']

function select(): HTMLSelectElement {
  return document.querySelector<HTMLSelectElement>('[data-rx-timezone-select]')!
}

/**
 * Selected by *value*, not by visible text. The option text is assembled from
 * the engine's own ICU, and this suite runs on three of them.
 */
async function choose(zone = 'Asia/Tokyo') {
  await page.getByRole('combobox').selectOptions(zone)
}

describe('native form, no library', () => {
  it('posts the IANA id under its name, with no hidden input', async () => {
    const onSubmit = vi.fn()
    const screen = await render(
      <form
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit(Object.fromEntries(new FormData(event.currentTarget)))
        }}
      >
        <TimezoneInput name="zone" label="Time zone" zones={ZONES} defaultValue="Europe/Madrid" />
        <button type="submit">Save</button>
      </form>,
    )
    await choose()
    await page.getByRole('button', { name: 'Save' }).click()

    expect(onSubmit).toHaveBeenCalledWith({ zone: 'Asia/Tokyo' })
    expect(screen.container.querySelectorAll('input[type="hidden"]')).toHaveLength(0)
  })

  /**
   * The failure this guards is quiet and expensive: a `<select>` whose value
   * matches no option paints its first one, so a field holding nothing would
   * *show* — and post — whichever zone happened to sort first, while `onChange`
   * had never fired. The empty option is what keeps the DOM and the model
   * agreeing.
   */
  it('posts nothing rather than a zone the user never chose', async () => {
    const onSubmit = vi.fn()
    await render(
      <form
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit(Object.fromEntries(new FormData(event.currentTarget)))
        }}
      >
        <TimezoneInput name="zone" label="Time zone" zones={ZONES} />
        <button type="submit">Save</button>
      </form>,
    )
    await page.getByRole('button', { name: 'Save' }).click()

    expect(onSubmit).toHaveBeenCalledWith({ zone: '' })
  })

  it('refuses every edit while disabled, so a disabled field cannot be steered', async () => {
    await render(
      <TimezoneInput
        name="zone"
        label="Time zone"
        zones={ZONES}
        defaultValue="Europe/Madrid"
        disabled
      />,
    )

    expect(select().disabled).toBe(true)
    expect(select().value).toBe('Europe/Madrid')
  })
})

describe('react-hook-form via Controller', () => {
  function Harness({ onValid }: { onValid: (value: unknown) => void }) {
    const { control, handleSubmit } = useForm<{ zone: string | null }>({
      defaultValues: { zone: null },
    })
    return (
      <form
        onSubmit={(event) => {
          void handleSubmit(onValid)(event)
        }}
      >
        <Controller
          name="zone"
          control={control}
          render={({ field }) => (
            <TimezoneInput
              label="Time zone"
              zones={ZONES}
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

  it('binds the id and submits it', async () => {
    const onValid = vi.fn()
    await render(<Harness onValid={onValid} />)
    await choose()
    await page.getByRole('button', { name: 'Save' }).click()

    await vi.waitFor(() => {
      expect(onValid).toHaveBeenCalledWith({ zone: 'Asia/Tokyo' }, expect.anything())
    })
  })
})

describe('formik via useField', () => {
  function Field() {
    const [field, meta, helpers] = useField<string | null>('zone')
    return (
      <>
        <TimezoneInput
          label="Time zone"
          name="zone"
          zones={ZONES}
          value={field.value}
          onChange={(value) => void helpers.setValue(value)}
          onBlur={() => void helpers.setTouched(true)}
        />
        <output data-testid="touched">{String(meta.touched)}</output>
      </>
    )
  }

  it('drives Formik state and submits the id', async () => {
    const onSubmit = vi.fn()
    await render(
      <Formik initialValues={{ zone: null }} onSubmit={(values) => onSubmit(values)}>
        <Form>
          <Field />
          <button type="submit">Save</button>
        </Form>
      </Formik>,
    )
    await choose()
    await page.getByRole('button', { name: 'Save' }).click()

    await vi.waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ zone: 'Asia/Tokyo' })
    })
  })

  it('marks touched only once focus leaves the field', async () => {
    await render(
      <Formik initialValues={{ zone: null }} onSubmit={() => undefined}>
        <Form>
          <Field />
          <button type="submit">Save</button>
        </Form>
      </Formik>,
    )
    select().focus()
    await choose()

    await expect.element(page.getByTestId('touched')).toHaveTextContent('false')

    await page.getByRole('button', { name: 'Save' }).click()

    await expect.element(page.getByTestId('touched')).toHaveTextContent('true')
  })
})

describe('react-final-form via Field', () => {
  it('binds the field and submits the id', async () => {
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
            <FinalField name="zone">
              {({ input }) => (
                <TimezoneInput
                  label="Time zone"
                  zones={ZONES}
                  name={input.name}
                  // RFF starts a field as `''`, which is not a zone. The
                  // component takes `null` for empty, and the binding is where
                  // that translation belongs.
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
    await choose()
    await page.getByRole('button', { name: 'Save' }).click()

    await vi.waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ zone: 'Asia/Tokyo' })
    })
  })
})

describe('TanStack Form via form.Field', () => {
  function Harness({ onValid }: { onValid: (value: unknown) => void }) {
    const form = useTanstackForm({
      defaultValues: { zone: null as string | null },
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
        <form.Field name="zone">
          {(field) => (
            <TimezoneInput
              label="Time zone"
              name="zone"
              zones={ZONES}
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

  it('binds the field and submits the id', async () => {
    const onValid = vi.fn()
    await render(<Harness onValid={onValid} />)
    await choose()
    await page.getByRole('button', { name: 'Save' }).click()

    await vi.waitFor(() => {
      expect(onValid).toHaveBeenCalledWith({ zone: 'Asia/Tokyo' })
    })
  })
})

/**
 * The claim the whole package rests on, exercised through a form rather than
 * asserted about a helper: what reaches a backend is an id, so the offset is
 * still derivable — and still correct — at whatever instant that backend cares
 * about. A stored offset would have frozen one answer.
 */
describe('what a form stores', () => {
  it('is an id, so it survives a daylight-saving change', async () => {
    const onSubmit = vi.fn()
    await render(
      <form
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit(Object.fromEntries(new FormData(event.currentTarget)))
        }}
      >
        <TimezoneInput
          name="zone"
          label="Time zone"
          zones={ZONES}
          referenceDate={new Date('2026-01-15T12:00:00Z')}
        />
        <button type="submit">Save</button>
      </form>,
    )
    await choose('America/New_York')
    await page.getByRole('button', { name: 'Save' }).click()

    // Chosen while the field was labelled -05:00; what is stored says nothing
    // about the season.
    expect(onSubmit).toHaveBeenCalledWith({ zone: 'America/New_York' })
  })
})
