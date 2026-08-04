import { describe, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { useRef, useState } from 'react'
import { PhoneInput } from '../PhoneInput'

/**
 * The development-diagnostics path and the defensive edges. These need a real
 * mount: the warnings fire from an effect, and the disabled/read-only guards in
 * the hook are only observable through real events.
 */
function input(container: HTMLElement) {
  return container.querySelector<HTMLInputElement>('[data-rphi-input]')!
}

function select(container: HTMLElement) {
  return container.querySelector<HTMLSelectElement>('[data-rphi-country]')!
}

describe('onWarn', () => {
  it('reports an unknown controlled country', async () => {
    const onWarn = vi.fn()
    await render(<PhoneInput label="Phone" country="ZZ" onWarn={onWarn} />)
    expect(onWarn).toHaveBeenCalledWith(expect.objectContaining({ code: 'unknown-country' }))
  })

  it('reports an unknown default country', async () => {
    const onWarn = vi.fn()
    await render(<PhoneInput label="Phone" defaultCountry="ZZ" onWarn={onWarn} />)
    expect(onWarn).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'unknown-default-country' }),
    )
  })

  it('warns once per distinct problem, not once per keystroke', async () => {
    const onWarn = vi.fn()
    const { container } = await render(
      <PhoneInput label="Phone" defaultCountry="ZZ" onWarn={onWarn} />,
    )
    await userEvent.fill(input(container), '4155552671')
    expect(onWarn.mock.calls.filter(([w]) => w.code === 'unknown-default-country')).toHaveLength(1)
  })

  it('falls back to console.warn when no handler is supplied', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    try {
      await render(<PhoneInput label="Phone" defaultCountry="ZZ" />)
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('[react-phone-input]'))
    } finally {
      warn.mockRestore()
    }
  })

  it('says nothing when everything is fine', async () => {
    const onWarn = vi.fn()
    // No `locale`, no `countries`, a known country and a well-formed value.
    await render(
      <PhoneInput label="Phone" defaultCountry="GB" defaultValue="+442071234567" onWarn={onWarn} />,
    )
    expect(onWarn).not.toHaveBeenCalled()
  })
})

describe('country names', () => {
  it('uses the runtime locale when none is given', async () => {
    const { container } = await render(
      <PhoneInput label="Phone" countries={['DE']} defaultCountry="DE" />,
    )
    // Whatever the runtime locale is, it must be a name and not an empty option.
    expect((select(container).options[0]?.textContent ?? '').length).toBeGreaterThan(4)
  })

  it('uses an explicit locale when one is given', async () => {
    const { container } = await render(
      <PhoneInput label="Phone" countries={['DE']} defaultCountry="DE" locale="de" />,
    )
    expect(select(container).options[0]?.textContent).toContain('Deutschland')
  })
})

describe('initial state', () => {
  it('takes the country from the initial value, not from defaultCountry', async () => {
    // Otherwise the select and the number disagree on the very first frame.
    const { container } = await render(
      <PhoneInput label="Phone" defaultCountry="US" defaultValue="+442071234567" />,
    )
    expect(select(container).value).toBe('GB')
  })

  it('falls back to defaultCountry when there is no initial value', async () => {
    const { container } = await render(<PhoneInput label="Phone" defaultCountry="FR" />)
    expect(select(container).value).toBe('FR')
  })

  it('falls back to the first listed country when defaultCountry is unusable', async () => {
    const { container } = await render(
      <PhoneInput
        label="Phone"
        countries={['SE', 'NO']}
        defaultCountry="ZZ"
        onWarn={() => undefined}
      />,
    )
    expect(select(container).value).toBe('SE')
  })
})

describe('refs and labels', () => {
  it('populates an object ref as well as a callback ref', async () => {
    function Harness() {
      const ref = useRef<HTMLInputElement>(null)
      const [tag, setTag] = useState('none')
      return (
        <>
          <PhoneInput label="Phone" ref={ref} />
          <button
            type="button"
            onClick={() => {
              setTag(ref.current?.tagName ?? 'none')
            }}
          >
            Read ref
          </button>
          <output data-testid="tag">{tag}</output>
        </>
      )
    }
    await render(<Harness />)
    await page.getByRole('button', { name: 'Read ref' }).click()
    await expect.element(page.getByTestId('tag')).toHaveTextContent('INPUT')
  })

  it('renders without a label element when none is given', async () => {
    const { container } = await render(<PhoneInput aria-describedby="hint" />)
    expect(container.querySelector('[data-rphi-root] > label')).toBeNull()
  })
})

describe('guards', () => {
  it('ignores a country change while disabled', async () => {
    const onCountryChange = vi.fn()
    const { container } = await render(
      <PhoneInput
        label="Phone"
        disabled
        countries={['GB', 'FR']}
        defaultCountry="GB"
        onCountryChange={onCountryChange}
      />,
    )
    expect(select(container)).toBeDisabled()
    expect(onCountryChange).not.toHaveBeenCalled()
  })

  it('ignores typing while read-only', async () => {
    const onChange = vi.fn()
    const { container } = await render(
      <PhoneInput label="Phone" readOnly value="+14155552671" onChange={onChange} />,
    )
    // Driven through the native setter rather than `userEvent.fill`, which
    // refuses a read-only field before the component ever sees the event. The
    // guard under test is the hook's, and a read-only DOM input still fires
    // `input` for programmatic writes — so this is the only way to reach it.
    const box = input(container)
    // Called through the descriptor rather than pulled into a variable, which
    // the lint config rightly flags as an unbound method.
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(box, '999')
    box.dispatchEvent(new Event('input', { bubbles: true }))

    await vi.waitFor(() => {
      expect(box.value).toBe('+1 415 555 2671')
    })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('keeps the select in step when a typed calling code changes the country', async () => {
    const { container } = await render(<PhoneInput label="Phone" defaultCountry="US" />)
    await userEvent.fill(input(container), '+33612345678')
    expect(select(container).value).toBe('FR')
    expect(container.querySelector('[data-rphi-root]')).toHaveAttribute('data-country', 'FR')
  })

  it('lets an explicit calling code win over a controlled country, and says so', async () => {
    // A deliberate reading of "controlled". `country` controls which country
    // *national* input is interpreted against; a number typed as `+33 …` is
    // French by its own contents, and showing "United States" beside it would
    // break the stronger invariant that the select and the text never disagree
    // about what is in the field. The parent is told through `onCountryChange`
    // and can reject the number if it does not want it.
    const onCountryChange = vi.fn()
    const { container } = await render(
      <PhoneInput label="Phone" country="US" onCountryChange={onCountryChange} />,
    )
    await userEvent.fill(input(container), '+33612345678')
    expect(onCountryChange).toHaveBeenCalledWith('FR')
    expect(select(container).value).toBe('FR')
  })

  it('does not restore the caret when the field is not focused', async () => {
    // Setting a selection on an unfocused input steals focus in some engines,
    // which would yank the page around when a parent updates the value.
    const { container } = await render(
      <PhoneInput label="Phone" defaultCountry="US" defaultValue="+14155552671" />,
    )
    const box = input(container)
    box.blur()
    await userEvent.selectOptions(select(container), 'GB')
    expect(document.activeElement).not.toBe(box)
  })
})
