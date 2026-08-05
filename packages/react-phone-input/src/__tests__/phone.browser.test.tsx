import { describe, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { useState } from 'react'
import { PhoneInput } from '../PhoneInput'

/**
 * Chromium, not jsdom. Caret restoration across as-you-type reformatting needs
 * a real selection model, and the blur-inside-the-field logic needs real
 * `relatedTarget` — jsdom fakes both.
 */
function input(container: HTMLElement) {
  return container.querySelector<HTMLInputElement>('[data-rx-phone-input]')!
}

function select(container: HTMLElement) {
  return container.querySelector<HTMLSelectElement>('[data-rx-phone-country]')!
}

describe('typing', () => {
  it('formats a national number as it is typed', async () => {
    const { container } = await render(<PhoneInput label="Phone" defaultCountry="US" />)
    await userEvent.fill(input(container), '4155552671')
    expect(input(container).value).toBe('415 555 2671')
  })

  it('reports E.164 plus the details', async () => {
    const onChange = vi.fn()
    const { container } = await render(
      <PhoneInput label="Phone" defaultCountry="US" onChange={onChange} />,
    )
    await userEvent.fill(input(container), '4155552671')
    expect(onChange).toHaveBeenLastCalledWith('+14155552671', {
      e164: '+14155552671',
      country: 'US',
      national: '4155552671',
      possible: true,
    })
  })

  it('marks a number that is not a possible length', async () => {
    const onChange = vi.fn()
    const { container } = await render(
      <PhoneInput label="Phone" defaultCountry="US" onChange={onChange} />,
    )
    await userEvent.fill(input(container), '41555')
    expect(onChange).toHaveBeenLastCalledWith(
      '+141555',
      expect.objectContaining({ possible: false }),
    )
    expect(container.querySelector('[data-rx-phone-root]')).not.toHaveAttribute('data-possible')
  })

  it('survives the plus being typed on its own, one keystroke at a time', async () => {
    // `userEvent.fill` sets the whole string at once and hides this entirely:
    // the bug was that the lone `+` was erased before any digit arrived.
    const { container } = await render(<PhoneInput label="Phone" defaultCountry="GB" />)
    const box = input(container)
    box.focus()
    await userEvent.keyboard('+')
    expect(box.value).toBe('+')
    await userEvent.keyboard('33612345678')
    expect(box.value).toBe('+33 6 12 34 56 78')
    expect(select(container).value).toBe('FR')
  })

  it('switches to international mode when the user types a plus', async () => {
    const { container } = await render(<PhoneInput label="Phone" defaultCountry="US" />)
    await userEvent.fill(input(container), '+442071234567')
    expect(input(container).value).toBe('+44 2071 234567')
  })

  it('moves the country select to match a typed calling code', async () => {
    // The select and the text can never disagree about which country the number
    // in the box belongs to.
    const { container } = await render(<PhoneInput label="Phone" defaultCountry="US" />)
    await userEvent.fill(input(container), '+442071234567')
    expect(select(container).value).toBe('GB')
    expect(container.querySelector('[data-rx-phone-root]')).toHaveAttribute('data-country', 'GB')
  })

  it('reports a country change made by typing', async () => {
    const onCountryChange = vi.fn()
    const { container } = await render(
      <PhoneInput label="Phone" defaultCountry="US" onCountryChange={onCountryChange} />,
    )
    await userEvent.fill(input(container), '+4420')
    expect(onCountryChange).toHaveBeenCalledWith('GB')
  })

  it('strips a national trunk prefix', async () => {
    const onChange = vi.fn()
    const { container } = await render(
      <PhoneInput label="Phone" defaultCountry="GB" onChange={onChange} />,
    )
    await userEvent.fill(input(container), '02071234567')
    expect(onChange).toHaveBeenLastCalledWith('+442071234567', expect.anything())
  })

  it('accepts pasted punctuation', async () => {
    const onChange = vi.fn()
    const { container } = await render(
      <PhoneInput label="Phone" defaultCountry="US" onChange={onChange} />,
    )
    await userEvent.fill(input(container), '(415) 555-2671')
    expect(onChange).toHaveBeenLastCalledWith('+14155552671', expect.anything())
  })
})

describe('the caret', () => {
  it('stays on the same digit when a separator is inserted', async () => {
    // The reason this file runs in a browser. Typing `4155` reformats to
    // `415 5`; a naive restore puts the caret before the space and the next
    // keystroke lands in the wrong group.
    const { container } = await render(<PhoneInput label="Phone" defaultCountry="US" />)
    const box = input(container)
    box.focus()
    await userEvent.fill(box, '4155')
    expect(box.value).toBe('415 5')
    expect(box.selectionStart).toBe(box.value.length)
  })

  it('keeps the caret mid-string when editing in the middle', async () => {
    const { container } = await render(
      <PhoneInput label="Phone" defaultCountry="US" defaultValue="+14155552671" />,
    )
    const box = input(container)
    box.focus()
    // Put the caret after the third digit and type one more.
    box.setSelectionRange(3, 3)
    await userEvent.keyboard('9')
    await vi.waitFor(() => {
      expect(box.value.replace(/\D/g, '')).toBe('194155552671')
    })
    // The assertion is about the *digit* the caret sits after, not the character
    // offset: the reformat moves every space, so an offset comparison would be
    // testing the grouping rather than the caret. Two digits — the `1` that was
    // already there and the `9` just typed — so the caret is exactly where the
    // user left it, not pushed to the end.
    const before = box.value.slice(0, box.selectionStart ?? 0).replace(/\D/g, '')
    expect(before).toBe('19')
  })
})

describe('the country select', () => {
  it('lists every country by default, with flag, name and calling code', async () => {
    const { container } = await render(<PhoneInput label="Phone" locale="en" />)
    const options = select(container).options
    expect(options.length).toBeGreaterThan(200)
    const gb = Array.from(options).find((option) => option.value === 'GB')
    expect(gb?.textContent).toContain('United Kingdom')
    expect(gb?.textContent).toContain('+44')
    expect(gb?.textContent).toContain('🇬🇧')
  })

  it('can be restricted, in the order given', async () => {
    const { container } = await render(
      <PhoneInput label="Phone" countries={['GB', 'IE', 'FR']} defaultCountry="GB" />,
    )
    expect(Array.from(select(container).options).map((option) => option.value)).toEqual([
      'GB',
      'IE',
      'FR',
    ])
  })

  it('localises the names', async () => {
    const { container } = await render(
      <PhoneInput label="Phone" countries={['DE']} defaultCountry="DE" locale="fr" />,
    )
    expect(select(container).options[0]?.textContent).toContain('Allemagne')
  })

  it('keeps the typed digits when the country changes', async () => {
    // The digits are the user's input; the calling code is ours. Clearing the
    // field on a country change throws away work they did not ask to lose.
    const onChange = vi.fn()
    const { container } = await render(
      <PhoneInput label="Phone" defaultCountry="GB" onChange={onChange} />,
    )
    await userEvent.fill(input(container), '2071234567')
    await userEvent.selectOptions(select(container), 'IE')
    expect(onChange).toHaveBeenLastCalledWith('+3532071234567', expect.anything())
    // Every digit survived; only the grouping changed, because Ireland groups
    // differently from the United Kingdom.
    expect(input(container).value.replace(/\D/g, '')).toBe('2071234567')
  })

  it('can be hidden entirely', async () => {
    const { container } = await render(<PhoneInput label="Phone" hideCountrySelect />)
    expect(container.querySelector('[data-rx-phone-country]')).toBeNull()
  })

  it('renders custom option contents', async () => {
    const { container } = await render(
      <PhoneInput
        label="Phone"
        countries={['GB']}
        defaultCountry="GB"
        renderCountry={(state) => `${state.country.iso2} (+${state.country.dial})`}
      />,
    )
    expect(select(container).options[0]?.textContent).toBe('GB (+44)')
  })
})

describe('controlled use', () => {
  it('follows the parent', async () => {
    function Harness() {
      const [value, setValue] = useState('+14155552671')
      return (
        <>
          <PhoneInput label="Phone" value={value} onChange={setValue} />
          <button
            type="button"
            onClick={() => {
              setValue('+442071234567')
            }}
          >
            Set UK
          </button>
        </>
      )
    }
    const { container } = await render(<Harness />)
    expect(input(container).value).toBe('+1 415 555 2671')
    await page.getByRole('button', { name: 'Set UK' }).click()
    expect(input(container).value).toBe('+44 2071 234567')
  })

  it('does not reformat the partial number a parent echoes back', async () => {
    // A parent storing our own `onChange` value must not cause the text to be
    // rebuilt from E.164 mid-entry, or every keystroke fights the user.
    function Harness() {
      const [value, setValue] = useState('')
      return <PhoneInput label="Phone" defaultCountry="US" value={value} onChange={setValue} />
    }
    const { container } = await render(<Harness />)
    await userEvent.fill(input(container), '415')
    expect(input(container).value).toBe('415')
  })

  it('supports a controlled country', async () => {
    const onCountryChange = vi.fn()
    const { container } = await render(
      <PhoneInput label="Phone" country="GB" onCountryChange={onCountryChange} />,
    )
    await userEvent.selectOptions(select(container), 'FR')
    expect(onCountryChange).toHaveBeenCalledWith('FR')
    // Controlled and the parent did not accept it, so nothing moved.
    expect(select(container).value).toBe('GB')
  })
})

describe('forms', () => {
  it('posts E.164 under its name', async () => {
    let submitted: string | null = null
    const { container } = await render(
      <form
        onSubmit={(event) => {
          event.preventDefault()
          const entry = new FormData(event.currentTarget).get('phone')
          submitted = typeof entry === 'string' ? entry : null
        }}
      >
        <PhoneInput label="Phone" name="phone" defaultCountry="US" />
        <button type="submit">Save</button>
      </form>,
    )
    await userEvent.fill(input(container), '4155552671')
    await page.getByRole('button', { name: 'Save' }).click()
    // The box shows grouped national digits; the form gets the canonical value.
    expect(submitted).toBe('+14155552671')
  })

  it('emits no hidden field without a name', async () => {
    const { container } = await render(<PhoneInput label="Phone" />)
    expect(container.querySelector('[data-rx-phone-value]')).toBeNull()
  })

  it('forwards the ref to the input', async () => {
    let node: HTMLInputElement | null = null
    await render(
      <PhoneInput
        label="Phone"
        ref={(element) => {
          node = element
        }}
      />,
    )
    expect(node).toBeInstanceOf(HTMLInputElement)
  })

  it('fires onBlur only when focus leaves the whole field', async () => {
    const onBlur = vi.fn()
    const { container } = await render(
      <>
        <PhoneInput label="Phone" onBlur={onBlur} />
        <button type="button">Elsewhere</button>
      </>,
    )
    input(container).focus()
    select(container).focus()
    // Moving between the box and the select is still inside the field.
    expect(onBlur).not.toHaveBeenCalled()
    await page.getByRole('button', { name: 'Elsewhere' }).click()
    expect(onBlur).toHaveBeenCalledTimes(1)
  })
})

describe('states', () => {
  it('refuses input while disabled', async () => {
    const onChange = vi.fn()
    const { container } = await render(<PhoneInput label="Phone" disabled onChange={onChange} />)
    expect(input(container)).toBeDisabled()
    expect(select(container)).toBeDisabled()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('locks the select while read-only', async () => {
    // A read-only field whose country could still be changed would let the
    // value change without the number changing.
    const { container } = await render(
      <PhoneInput label="Phone" readOnly value="+14155552671" onChange={() => undefined} />,
    )
    expect(input(container)).toHaveAttribute('readonly')
    expect(select(container)).toBeDisabled()
  })
})

describe('country type-ahead', () => {
  it('starts every option with the country name, not the flag', async () => {
    // A native select's type-ahead matches from the start of the option text.
    // A leading flag emoji means the string starts with a regional-indicator
    // pair, so pressing "f" matches nothing and the picker feels broken.
    const { container } = await render(<PhoneInput label="Phone" defaultCountry="US" />)
    const options = Array.from(select(container).options)
    expect(options.length).toBeGreaterThan(200)
    for (const option of options.slice(0, 40)) {
      expect(option.text.startsWith('\u{1F1E6}')).toBe(false)
      // Letter, digit or a locale's own script — never punctuation or a symbol.
      expect(/^[\p{L}\p{N}]/u.test(option.text)).toBe(true)
    }
  })

  it('puts France under "F", where a type-ahead would look for it', async () => {
    const { container } = await render(<PhoneInput label="Phone" defaultCountry="US" />)
    const france = Array.from(select(container).options).find((o) => o.value === 'FR')
    expect(france?.text.startsWith('France')).toBe(true)
    expect(france?.text).toContain('+33')
  })

  it('keeps the flag and the dial code in the option', async () => {
    const { container } = await render(<PhoneInput label="Phone" defaultCountry="US" />)
    const us = Array.from(select(container).options).find((o) => o.value === 'US')
    expect(us?.text).toBe('United States \u{1F1FA}\u{1F1F8} +1')
  })

  it('still honours renderCountry', async () => {
    const { container } = await render(
      <PhoneInput label="Phone" defaultCountry="US" renderCountry={(s) => s.country.iso2} />,
    )
    const us = Array.from(select(container).options).find((o) => o.value === 'US')
    expect(us?.text).toBe('US')
  })
})

describe('validity feedback', () => {
  function feedback(container: HTMLElement) {
    return container.querySelector('[data-rx-phone-validity]')
  }

  it('says nothing before the field has been left', async () => {
    // Every number is the wrong length while it is still being typed.
    const { container } = await render(
      <PhoneInput label="Phone" defaultCountry="US" showValidity />,
    )
    await userEvent.fill(input(container), '415555')
    expect(feedback(container)).toBeNull()
  })

  it('reports a length the country does not use, once blurred', async () => {
    const { container } = await render(
      <>
        <PhoneInput label="Phone" defaultCountry="US" showValidity />
        <button type="button">elsewhere</button>
      </>,
    )
    await userEvent.fill(input(container), '415555')
    await page.getByRole('button', { name: 'elsewhere' }).click()
    expect(feedback(container)).toHaveTextContent('not a length used by United States numbers')
    expect(input(container)).toHaveAttribute('aria-invalid', 'true')
  })

  it('confirms a number that is a plausible length', async () => {
    const { container } = await render(
      <>
        <PhoneInput label="Phone" defaultCountry="US" showValidity />
        <button type="button">elsewhere</button>
      </>,
    )
    await userEvent.fill(input(container), '4155552671')
    await page.getByRole('button', { name: 'elsewhere' }).click()
    expect(feedback(container)).toHaveTextContent('United States')
    expect(feedback(container)).toHaveAttribute('data-possible')
    expect(input(container)).not.toHaveAttribute('aria-invalid')
  })

  it('says nothing about an empty field', async () => {
    // Emptiness is `required`'s business, not this message's.
    const { container } = await render(
      <>
        <PhoneInput label="Phone" defaultCountry="US" showValidity />
        <button type="button">elsewhere</button>
      </>,
    )
    input(container).focus()
    await page.getByRole('button', { name: 'elsewhere' }).click()
    expect(feedback(container)).toBeNull()
  })

  it('is announced politely and described by the input', async () => {
    const { container } = await render(
      <>
        <PhoneInput label="Phone" defaultCountry="US" showValidity />
        <button type="button">elsewhere</button>
      </>,
    )
    await userEvent.fill(input(container), '415')
    await page.getByRole('button', { name: 'elsewhere' }).click()
    const note = feedback(container)!
    expect(note).toHaveAttribute('aria-live', 'polite')
    expect(input(container).getAttribute('aria-describedby')).toContain(note.id)
  })

  it('takes a custom message, including an empty one', async () => {
    const { container } = await render(
      <>
        <PhoneInput
          label="Phone"
          defaultCountry="US"
          showValidity
          validityLabel={({ possible }) => (possible ? 'good' : '')}
        />
        <button type="button">elsewhere</button>
      </>,
    )
    await userEvent.fill(input(container), '415')
    await page.getByRole('button', { name: 'elsewhere' }).click()
    expect(feedback(container)).toHaveTextContent('')
  })

  it('stays quiet when showValidity is off', async () => {
    const { container } = await render(
      <>
        <PhoneInput label="Phone" defaultCountry="US" />
        <button type="button">elsewhere</button>
      </>,
    )
    await userEvent.fill(input(container), '415')
    await page.getByRole('button', { name: 'elsewhere' }).click()
    expect(feedback(container)).toBeNull()
  })

  it('lets an explicit invalid prop win over the inferred one', async () => {
    const { container } = await render(
      <>
        <PhoneInput label="Phone" defaultCountry="US" showValidity invalid={false} />
        <button type="button">elsewhere</button>
      </>,
    )
    await userEvent.fill(input(container), '415')
    await page.getByRole('button', { name: 'elsewhere' }).click()
    expect(input(container)).not.toHaveAttribute('aria-invalid')
  })
})
