import { describe, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { useState } from 'react'
import { PhoneInput } from '../PhoneInput'
import { usePhoneInput } from '../usePhoneInput'
import type { UsePhoneInputOptions } from '../usePhoneInput'

/**
 * The headless hook, driven directly.
 *
 * `usePhoneInput` is public API, so its guards deserve tests of their own — and
 * some of them are unreachable through the rendered component by design. The
 * country select is disabled while the field is disabled or read-only, so the
 * only way to reach `selectCountry`'s own guards is the way a consumer building
 * a custom renderer would: by calling them.
 */
function Harness(props: UsePhoneInputOptions & { probe?: string }) {
  const field = usePhoneInput(props)
  return (
    <div>
      <output data-testid="value">{field.value || 'empty'}</output>
      <output data-testid="country">{field.country?.iso2 ?? 'none'}</output>
      <output data-testid="possible">{String(field.details.possible)}</output>
      <button
        type="button"
        onClick={() => {
          field.selectCountry(props.probe ?? 'FR')
        }}
      >
        Pick
      </button>
    </div>
  )
}

describe('selectCountry guards', () => {
  it('refuses a country change while disabled', async () => {
    const onCountryChange = vi.fn()
    await render(
      <Harness
        disabled
        defaultCountry="GB"
        defaultValue="+442071234567"
        onCountryChange={onCountryChange}
      />,
    )
    await page.getByRole('button', { name: 'Pick' }).click()
    expect(onCountryChange).not.toHaveBeenCalled()
    await expect.element(page.getByTestId('country')).toHaveTextContent('GB')
  })

  it('refuses a country change while read-only', async () => {
    const onCountryChange = vi.fn()
    await render(
      <Harness
        readOnly
        defaultCountry="GB"
        defaultValue="+442071234567"
        onCountryChange={onCountryChange}
      />,
    )
    await page.getByRole('button', { name: 'Pick' }).click()
    expect(onCountryChange).not.toHaveBeenCalled()
  })

  it('ignores an ISO code that is not in the table', async () => {
    // A custom renderer can hand us anything; an unknown code must be a no-op
    // rather than blanking the field.
    const onCountryChange = vi.fn()
    await render(<Harness defaultCountry="GB" probe="ZZ" onCountryChange={onCountryChange} />)
    await page.getByRole('button', { name: 'Pick' }).click()
    expect(onCountryChange).not.toHaveBeenCalled()
    await expect.element(page.getByTestId('country')).toHaveTextContent('GB')
  })

  it('changes country and rebuilds the value when the code is known', async () => {
    const onCountryChange = vi.fn()
    await render(
      <Harness
        defaultCountry="GB"
        defaultValue="+442071234567"
        onCountryChange={onCountryChange}
      />,
    )
    await page.getByRole('button', { name: 'Pick' }).click()
    expect(onCountryChange).toHaveBeenCalledWith('FR')
    await expect.element(page.getByTestId('value')).toHaveTextContent('+332071234567')
  })
})

describe('controlled value edges', () => {
  it('clears the text when a controlled value becomes empty', async () => {
    function Controlled() {
      const [value, setValue] = useState('+14155552671')
      return (
        <>
          <PhoneInput label="Phone" value={value} onChange={setValue} />
          <button
            type="button"
            onClick={() => {
              setValue('')
            }}
          >
            Clear
          </button>
        </>
      )
    }
    const { container } = await render(<Controlled />)
    await page.getByRole('button', { name: 'Clear' }).click()
    expect(container.querySelector<HTMLInputElement>('[data-rphi-input]')!.value).toBe('')
  })
})

describe('diagnostics deduplication', () => {
  it('reports the same problem once even when the effect re-runs', async () => {
    // The handler identity changes on every render here, so the warn effect
    // re-runs on each parent update. It must still report each problem once.
    const seen: string[] = []
    function Noisy() {
      const [tick, setTick] = useState(0)
      return (
        <>
          <PhoneInput
            label="Phone"
            defaultCountry="ZZ"
            onWarn={(warning) => {
              seen.push(warning.code)
            }}
          />
          <button
            type="button"
            onClick={() => {
              setTick(tick + 1)
            }}
          >
            Re-render
          </button>
        </>
      )
    }
    await render(<Noisy />)
    await page.getByRole('button', { name: 'Re-render' }).click()
    await page.getByRole('button', { name: 'Re-render' }).click()
    expect(seen.filter((code) => code === 'unknown-default-country')).toHaveLength(1)
  })
})

describe('caret restoration', () => {
  it('does not touch the selection when the field is not focused', async () => {
    // Setting a selection on an unfocused input steals focus in some engines,
    // which would yank the page around whenever a value arrives from elsewhere.
    const { container } = await render(<PhoneInput label="Phone" defaultCountry="US" />)
    const box = container.querySelector<HTMLInputElement>('[data-rphi-input]')!
    const outside = document.createElement('button')
    document.body.appendChild(outside)
    outside.focus()

    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(
      box,
      '4155552671',
    )
    box.dispatchEvent(new Event('input', { bubbles: true }))

    await vi.waitFor(() => {
      expect(box.value).toBe('415 555 2671')
    })
    expect(document.activeElement).toBe(outside)
    outside.remove()
  })

  it('does restore it when the field is focused', async () => {
    const { container } = await render(<PhoneInput label="Phone" defaultCountry="US" />)
    const box = container.querySelector<HTMLInputElement>('[data-rphi-input]')!
    box.focus()
    await userEvent.fill(box, '415555')
    expect(document.activeElement).toBe(box)
    expect(box.selectionStart).toBe(box.value.length)
  })
})
