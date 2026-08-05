import { describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { CurrencyInput } from '../CurrencyInput'
import type { CurrencyInputProps } from '../types'

/**
 * The `formatMode="blur"` suite: a plain number while focused, formatted on
 * blur. (Live mode — the default — has its own file.) These are real browser
 * behaviours; jsdom's input selection model is a fiction and its Intl is the
 * Node ICU build, so they run in a real Chromium.
 */

function Controlled(
  props: Omit<CurrencyInputProps, 'value' | 'onChange'> & { initial?: number | null },
) {
  const { initial = null, ...rest } = props
  const [value, setValue] = useState<number | null>(initial)
  return (
    <>
      <CurrencyInput
        formatMode="blur"
        {...rest}
        value={value}
        onChange={setValue}
        aria-label="amount"
      />
      <button type="button">blur target</button>
    </>
  )
}

const inputEl = () => page.getByRole('textbox', { name: 'amount' }).element() as HTMLInputElement

describe('idle vs focused display', () => {
  it('shows the formatted value while idle', async () => {
    await render(<Controlled locale="en-US" currency="USD" initial={1234.5} />)
    await expect.poll(() => inputEl().value).toBe('$1,234.5')
  })

  it('shows the plain editable number on focus', async () => {
    await render(<Controlled locale="en-US" currency="USD" initial={1234.5} />)
    await userEvent.click(page.getByRole('textbox', { name: 'amount' }))
    await expect.poll(() => inputEl().value).toBe('1234.5')
  })

  it('re-formats on blur', async () => {
    await render(<Controlled locale="en-US" currency="USD" initial={1234.5} />)
    await userEvent.click(page.getByRole('textbox', { name: 'amount' }))
    await userEvent.click(page.getByRole('button', { name: 'blur target' }))
    await expect.poll(() => inputEl().value).toBe('$1,234.5')
  })
})

describe('typing', () => {
  it('replaces a formatted value when fill focuses and edits in one browser action', async () => {
    await render(<Controlled locale="en-US" currency="USD" initial={50000} />)
    await userEvent.fill(page.getByRole('textbox', { name: 'amount' }), '12.34')
    await expect.poll(() => inputEl().value).toBe('12.34')
  })

  it('emits the parsed number on each keystroke', async () => {
    const onChange = vi.fn()
    await render(
      <CurrencyInput
        formatMode="blur"
        locale="en-US"
        currency="USD"
        defaultValue={null}
        onChange={onChange}
        aria-label="amount"
      />,
    )
    await userEvent.click(page.getByRole('textbox', { name: 'amount' }))
    await userEvent.type(page.getByRole('textbox', { name: 'amount' }), '50000')
    expect(onChange).toHaveBeenLastCalledWith(50000, expect.objectContaining({ value: 50000 }))
  })

  it('formats a freshly typed value on blur', async () => {
    await render(<Controlled locale="en-US" currency="USD" />)
    await userEvent.click(page.getByRole('textbox', { name: 'amount' }))
    await userEvent.type(page.getByRole('textbox', { name: 'amount' }), '50000')
    await userEvent.click(page.getByRole('button', { name: 'blur target' }))
    await expect.poll(() => inputEl().value).toBe('$50,000')
  })

  it('rejects letters, keeping only the numeric input', async () => {
    const onChange = vi.fn()
    await render(
      <CurrencyInput
        formatMode="blur"
        locale="en-US"
        currency="USD"
        onChange={onChange}
        aria-label="amount"
      />,
    )
    await userEvent.click(page.getByRole('textbox', { name: 'amount' }))
    await userEvent.type(page.getByRole('textbox', { name: 'amount' }), '12abc34')
    await expect.poll(() => inputEl().value).toBe('1234')
    expect(onChange).toHaveBeenLastCalledWith(1234, expect.anything())
  })

  it('drops the decimal for a zero-fraction currency (JPY)', async () => {
    await render(<Controlled locale="ja-JP" currency="JPY" />)
    const box = page.getByRole('textbox', { name: 'amount' })
    await userEvent.click(box)
    // A JPY field has no fractional part, so a pasted/filled "1234.56" keeps
    // only the integer.
    await userEvent.fill(box, '1234.56')
    await expect.poll(() => inputEl().value).toBe('1234')
  })

  it('uses the locale decimal separator (de-DE)', async () => {
    const onChange = vi.fn()
    await render(
      <CurrencyInput
        formatMode="blur"
        locale="de-DE"
        currency="EUR"
        onChange={onChange}
        aria-label="amount"
      />,
    )
    await userEvent.click(page.getByRole('textbox', { name: 'amount' }))
    await userEvent.type(page.getByRole('textbox', { name: 'amount' }), '1234,56')
    expect(onChange).toHaveBeenLastCalledWith(1234.56, expect.anything())
  })

  it('preserves a trailing locale decimal when a controlled parent echoes the value', async () => {
    await render(<Controlled locale="bg-BG" currency="EUR" />)
    const box = page.getByRole('textbox', { name: 'amount' })
    await userEvent.click(box)
    await userEvent.type(box, '5,')
    await expect.poll(() => inputEl().value).toBe('5,')
  })

  it('resynchronizes focused text when a controlled value changes externally', async () => {
    function ExternalUpdate() {
      const [value, setValue] = useState<number | null>(1)
      return (
        <>
          <CurrencyInput
            formatMode="blur"
            locale="en-US"
            currency="USD"
            value={value}
            onChange={setValue}
            aria-label="amount"
          />
          <button
            type="button"
            onMouseDown={(event) => {
              event.preventDefault()
            }}
            onClick={() => {
              setValue(42.5)
            }}
          >
            external update
          </button>
        </>
      )
    }
    await render(<ExternalUpdate />)
    await userEvent.click(page.getByRole('textbox', { name: 'amount' }))
    await userEvent.click(page.getByRole('button', { name: 'external update' }))
    await expect.poll(() => inputEl().value).toBe('42.5')
  })

  it('transforms raw browser input before sanitizing it', async () => {
    await render(
      <Controlled
        locale="en-US"
        currency="USD"
        transformRawValue={(raw) => raw.replace(/_/g, '')}
      />,
    )
    const box = page.getByRole('textbox', { name: 'amount' })
    await userEvent.click(box)
    await userEvent.type(box, '1_234')
    await expect.poll(() => inputEl().value).toBe('1234')
  })
})

describe('arrow stepping', () => {
  it('increments and decrements using the configured step', async () => {
    const onChange = vi.fn()
    await render(
      <CurrencyInput
        formatMode="blur"
        locale="en-US"
        currency="USD"
        defaultValue={1.2}
        step={0.1}
        onChange={onChange}
        aria-label="amount"
      />,
    )
    const box = page.getByRole('textbox', { name: 'amount' })
    await userEvent.click(box)
    await userEvent.keyboard('{ArrowUp}')
    await expect.poll(() => inputEl().value).toBe('1.3')
    expect(onChange).toHaveBeenLastCalledWith(1.3, expect.anything())
    await userEvent.keyboard('{ArrowDown}')
    await expect.poll(() => inputEl().value).toBe('1.2')
  })

  it('leaves arrow keys alone when no step is configured', async () => {
    const onChange = vi.fn()
    await render(
      <CurrencyInput
        formatMode="blur"
        locale="en-US"
        currency="USD"
        defaultValue={1}
        onChange={onChange}
        aria-label="amount"
      />,
    )
    await userEvent.click(page.getByRole('textbox', { name: 'amount' }))
    await userEvent.keyboard('{ArrowUp}')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('steps upward from an empty field and ignores modified arrows', async () => {
    const onChange = vi.fn()
    await render(
      <CurrencyInput
        formatMode="blur"
        locale="en-US"
        currency="USD"
        step={0.25}
        onChange={onChange}
        aria-label="amount"
      />,
    )
    await userEvent.click(page.getByRole('textbox', { name: 'amount' }))
    await userEvent.keyboard('{Control>}{ArrowUp}{/Control}')
    expect(onChange).not.toHaveBeenCalled()
    await userEvent.keyboard('{ArrowUp}')
    expect(onChange).toHaveBeenLastCalledWith(0.25, expect.anything())
  })

  it('clamps ArrowDown at zero when negative values are disabled', async () => {
    const onChange = vi.fn()
    await render(
      <CurrencyInput
        formatMode="blur"
        locale="en-US"
        currency="USD"
        defaultValue={0}
        step={0.25}
        onChange={onChange}
        aria-label="amount"
      />,
    )
    await userEvent.click(page.getByRole('textbox', { name: 'amount' }))
    await userEvent.keyboard('{ArrowDown}')
    await expect.poll(() => inputEl().value).toBe('0')
    expect(onChange).toHaveBeenLastCalledWith(0, expect.anything())
  })

  it('steps below zero when negative values are enabled', async () => {
    const onChange = vi.fn()
    await render(
      <CurrencyInput
        formatMode="blur"
        locale="en-US"
        currency="USD"
        defaultValue={0}
        step={0.25}
        allowNegative
        onChange={onChange}
        aria-label="amount"
      />,
    )
    await userEvent.click(page.getByRole('textbox', { name: 'amount' }))
    await userEvent.keyboard('{ArrowDown}')
    await expect.poll(() => inputEl().value).toBe('-0.25')
    expect(onChange).toHaveBeenLastCalledWith(-0.25, expect.anything())
  })

  it('ignores a non-positive step', async () => {
    const onChange = vi.fn()
    await render(
      <CurrencyInput
        formatMode="blur"
        locale="en-US"
        currency="USD"
        step={0}
        onChange={onChange}
        aria-label="amount"
      />,
    )
    await userEvent.click(page.getByRole('textbox', { name: 'amount' }))
    await userEvent.keyboard('{ArrowUp}')
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('paste', () => {
  it('parses a fully formatted amount pasted in', async () => {
    const onChange = vi.fn()
    await render(
      <CurrencyInput
        formatMode="blur"
        locale="fr-FR"
        currency="EUR"
        onChange={onChange}
        aria-label="amount"
      />,
    )
    const box = page.getByRole('textbox', { name: 'amount' })
    await userEvent.click(box)
    // Build the exact formatted string via a throwaway formatter would be
    // ideal, but a direct paste of a real fr-FR string exercises NBSP handling.
    const formatted = new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
    }).format(1234567.89)
    await userEvent.fill(box, formatted)
    expect(onChange).toHaveBeenLastCalledWith(1234567.89, expect.anything())
  })
})

describe('uncontrolled', () => {
  it('seeds from defaultValue and formats it', async () => {
    await render(
      <>
        <CurrencyInput
          formatMode="blur"
          locale="en-US"
          currency="USD"
          defaultValue={99}
          aria-label="amount"
        />
        <button type="button">blur target</button>
      </>,
    )
    await expect.poll(() => inputEl().value).toBe('$99')
  })
})

describe('negatives', () => {
  it('ignores a minus sign by default', async () => {
    await render(<Controlled locale="en-US" currency="USD" />)
    await userEvent.click(page.getByRole('textbox', { name: 'amount' }))
    await userEvent.type(page.getByRole('textbox', { name: 'amount' }), '-5')
    await expect.poll(() => inputEl().value).toBe('5')
  })

  it('keeps the minus sign when allowNegative is set', async () => {
    const onChange = vi.fn()
    await render(
      <CurrencyInput
        formatMode="blur"
        locale="en-US"
        currency="USD"
        allowNegative
        onChange={onChange}
        aria-label="amount"
      />,
    )
    await userEvent.click(page.getByRole('textbox', { name: 'amount' }))
    await userEvent.type(page.getByRole('textbox', { name: 'amount' }), '-5')
    expect(onChange).toHaveBeenLastCalledWith(-5, expect.anything())
  })
})

describe('accessibility hooks', () => {
  it('exposes aria-invalid and data-invalid when invalid', async () => {
    await render(
      <CurrencyInput
        formatMode="blur"
        locale="en-US"
        currency="USD"
        value={1}
        invalid
        aria-label="amount"
      />,
    )
    await expect.poll(() => inputEl().getAttribute('aria-invalid')).toBe('true')
    await expect.poll(() => inputEl().hasAttribute('data-invalid')).toBe(true)
  })

  it('forwards a ref to the underlying input', async () => {
    let node: HTMLInputElement | null = null
    await render(
      <CurrencyInput
        formatMode="blur"
        ref={(el) => {
          node = el
        }}
        locale="en-US"
        currency="USD"
        aria-label="amount"
      />,
    )
    await expect.poll(() => node?.tagName).toBe('INPUT')
  })
})

/* eslint-disable @typescript-eslint/no-deprecated -- the deprecated prop is the subject here. */
describe('the 1.0 onChange rename', () => {
  it('still fires the deprecated onValueChange, so a migration can be gradual', async () => {
    // Kept working rather than removed: this package was the one input in the
    // suite where `onChange` meant the DOM event, and breaking every call site
    // at once to fix that would cost more than the inconsistency did.
    const onValueChange = vi.fn()
    const { container } = await render(
      <CurrencyInput locale="en-US" currency="USD" onValueChange={onValueChange} />,
    )
    await userEvent.fill(container.querySelector('input')!, '12')

    expect(onValueChange).toHaveBeenCalledWith(12, expect.objectContaining({ value: 12 }))
  })

  it('fires both when both are given, one call site at a time', async () => {
    const onChange = vi.fn()
    const onValueChange = vi.fn()
    const { container } = await render(
      <CurrencyInput
        locale="en-US"
        currency="USD"
        onChange={onChange}
        onValueChange={onValueChange}
      />,
    )
    await userEvent.fill(container.querySelector('input')!, '5')

    expect(onChange).toHaveBeenCalledWith(5, expect.objectContaining({ value: 5 }))
    expect(onValueChange).toHaveBeenCalledWith(5, expect.objectContaining({ value: 5 }))
  })

  it('hands the raw DOM event to onNativeChange, which is where it moved', async () => {
    const onNativeChange = vi.fn()
    const { container } = await render(
      <CurrencyInput locale="en-US" currency="USD" onNativeChange={onNativeChange} />,
    )
    await userEvent.fill(container.querySelector('input')!, '7')

    expect(onNativeChange).toHaveBeenCalled()
    expect(onNativeChange.mock.calls[0]?.[0]).toHaveProperty('target')
  })
})
/* eslint-enable @typescript-eslint/no-deprecated */
