import { describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { StrictMode } from 'react'
import { PhoneInput } from '../PhoneInput'

/**
 * Chromium, not jsdom — and about event *sequences* rather than event handlers.
 *
 * The existing caret coverage inserts text and checks where the caret landed.
 * What it never does is *delete*: not one test in this package, at any layer,
 * presses Backspace. Deleting is where an as-you-type formatter goes wrong,
 * because the character under the caret is often a separator the formatter
 * itself inserted, and re-formatting puts it straight back.
 */
function input(container: HTMLElement) {
  return container.querySelector<HTMLInputElement>('[data-rx-phone-input]')!
}

/** Type a full number, then put the caret at `caret`. */
async function typedTo(container: HTMLElement, digits: string, caret: number) {
  const element = input(container)
  await userEvent.fill(element, digits)
  element.focus()
  element.setSelectionRange(caret, caret)
  return element
}

describe('backspace', () => {
  it('deletes the digit before a separator rather than the separator', async () => {
    /**
     * `415 555 2671` with the caret at offset 4 — immediately after the space,
     * before the second group. The character the browser actually removes is
     * the space, which the formatter re-inserts on the very next render: the
     * value comes back identical and the keystroke is dead. The digit before
     * the separator is what the user meant.
     */
    const { container } = await render(<PhoneInput label="Phone" defaultCountry="US" />)
    const element = await typedTo(container, '4155552671', 4)
    expect(element.value).toBe('415 555 2671')

    await userEvent.keyboard('{Backspace}')
    await vi.waitFor(() => {
      expect(element.value).toBe('415 552 671')
    })
    // Three digits went in before the caret, two remain: the caret belongs
    // after the second of them.
    expect(element.selectionStart).toBe(2)
  })

  it('deletes an ordinary digit without moving past it', async () => {
    const { container } = await render(<PhoneInput label="Phone" defaultCountry="US" />)
    const element = await typedTo(container, '4155552671', 6)
    expect(element.value).toBe('415 555 2671')

    await userEvent.keyboard('{Backspace}')
    await vi.waitFor(() => {
      expect(element.value).toBe('415 552 671')
    })
    expect(element.selectionStart).toBe(5)
  })

  it('empties the field one keystroke at a time, never stalling', async () => {
    /**
     * The whole point: every Backspace must remove exactly one digit. A
     * separator that costs a keystroke shows up here as a run that needs more
     * presses than there are digits.
     */
    const { container } = await render(<PhoneInput label="Phone" defaultCountry="US" />)
    const element = await typedTo(container, '4155552671', 12)

    for (let pressed = 1; pressed <= 10; pressed++) {
      await userEvent.keyboard('{Backspace}')
      const remaining = element.value.replace(/\D/g, '').length
      expect(remaining).toBe(10 - pressed)
    }
    expect(element.value).toBe('')
  })

  it('backspaces through an international number without stalling', async () => {
    const { container } = await render(<PhoneInput label="Phone" defaultCountry="US" />)
    const element = input(container)
    await userEvent.fill(element, '+442071838750')
    element.focus()
    element.setSelectionRange(element.value.length, element.value.length)

    const digits = element.value.replace(/\D/g, '').length
    for (let pressed = 1; pressed <= digits; pressed++) {
      await userEvent.keyboard('{Backspace}')
      expect(element.value.replace(/\D/g, '').length).toBe(digits - pressed)
    }
  })

  it('deletes a whole selected run in one keystroke', async () => {
    const { container } = await render(<PhoneInput label="Phone" defaultCountry="US" />)
    const element = await typedTo(container, '4155552671', 0)
    element.setSelectionRange(0, 8)

    await userEvent.keyboard('{Backspace}')
    await vi.waitFor(() => {
      // Four digits left, regrouped as a partial national number rather than
      // held back as a bare run.
      expect(element.value).toBe('267 1')
    })
    expect(element.selectionStart).toBe(0)
  })

  it('does nothing at the start of the field', async () => {
    const { container } = await render(<PhoneInput label="Phone" defaultCountry="US" />)
    const element = await typedTo(container, '4155552671', 0)

    await userEvent.keyboard('{Backspace}')
    expect(element.value).toBe('415 555 2671')
    expect(element.selectionStart).toBe(0)
  })

  it('reports the shortened number on every press', async () => {
    const onChange = vi.fn()
    const { container } = await render(
      <PhoneInput label="Phone" defaultCountry="US" onChange={onChange} />,
    )
    await typedTo(container, '4155552671', 12)
    onChange.mockClear()

    await userEvent.keyboard('{Backspace}')
    await vi.waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith(
        '+1415555267',
        expect.objectContaining({ national: '415555267' }),
      )
    })
  })
})

describe('forward delete', () => {
  it('deletes the digit after a separator rather than the separator', async () => {
    // The same dead keystroke, mirrored: the caret sits before a space the
    // formatter owns, and removing it changes nothing.
    const { container } = await render(<PhoneInput label="Phone" defaultCountry="US" />)
    const element = await typedTo(container, '4155552671', 3)
    expect(element.value).toBe('415 555 2671')

    await userEvent.keyboard('{Delete}')
    await vi.waitFor(() => {
      expect(element.value).toBe('415 552 671')
    })
    expect(element.selectionStart).toBe(3)
  })
})

describe('input method editors', () => {
  it('ignores a composition in flight and keeps the digits it can read', async () => {
    /**
     * A phone field is `inputmode="tel"`, but an IME can still be attached —
     * on Android a user may have a composing keyboard selected regardless. The
     * formatter must not be confused by non-digits arriving mid-composition.
     */
    const { container } = await render(<PhoneInput label="Phone" defaultCountry="US" />)
    const element = input(container)
    element.focus()
    element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
    await userEvent.fill(element, '415ねこ555')
    element.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }))

    await vi.waitFor(() => {
      expect(element.value).toBe('415 555')
    })
  })
})

describe('StrictMode', () => {
  it('formats, reports and re-syncs under a double render', async () => {
    // The controlled re-sync happens during render, which StrictMode invokes
    // twice. Nothing else in the suite renders under it.
    const onChange = vi.fn()
    const { container } = await render(
      <StrictMode>
        <PhoneInput label="Phone" defaultCountry="US" onChange={onChange} />
      </StrictMode>,
    )
    const element = input(container)
    await userEvent.fill(element, '4155552671')

    await vi.waitFor(() => {
      expect(element.value).toBe('415 555 2671')
    })
    expect(onChange).toHaveBeenLastCalledWith(
      '+14155552671',
      expect.objectContaining({ possible: true }),
    )
  })
})
