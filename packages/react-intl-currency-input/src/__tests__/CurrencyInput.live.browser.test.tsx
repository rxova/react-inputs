import { describe, expect, it, vi } from 'vitest'
import { useRef, useState } from 'react'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { CurrencyInput } from '../CurrencyInput'
import type { CurrencyInputProps } from '../types'

/**
 * The default `formatMode="live"` suite: the field formats as you type — grouping
 * and the symbol stay visible — and the caret is preserved. Caret position is a
 * real browser concern (jsdom's selection model is fiction), so this runs in a
 * real Chromium.
 */

function Controlled(
  props: Omit<CurrencyInputProps, 'value' | 'onChange'> & { initial?: number | null },
) {
  const { initial = null, ...rest } = props
  const [value, setValue] = useState<number | null>(initial)
  return <CurrencyInput {...rest} value={value} onChange={setValue} aria-label="amount" />
}

const box = () => page.getByRole('textbox', { name: 'amount' })
const inputEl = () => box().element() as HTMLInputElement

describe('formats as you type', () => {
  it('inserts group separators and the symbol live', async () => {
    await render(<Controlled locale="en-US" currency="USD" />)
    await userEvent.click(box())
    await userEvent.type(box(), '1234567')
    await expect.poll(() => inputEl().value).toBe('$1,234,567')
  })

  it('keeps the amount formatted while focused (not a plain number)', async () => {
    await render(<Controlled locale="en-US" currency="USD" initial={1234.5} />)
    await userEvent.click(box())
    await expect.poll(() => inputEl().value).toBe('$1,234.5')
  })

  it('reveals the Bulgarian space only above 9999, live', async () => {
    await render(<Controlled locale="bg-BG" currency="BGN" />)
    await userEvent.click(box())
    await userEvent.type(box(), '5000')
    await expect.poll(() => inputEl().value).toContain('5000')
    await userEvent.type(box(), '0')
    await expect.poll(() => inputEl().value).toMatch(/50\s?000/)
    await expect.poll(() => inputEl().value).not.toContain('50000')
  })

  it('uses German grouping and comma decimal live', async () => {
    await render(<Controlled locale="de-DE" currency="EUR" />)
    await userEvent.click(box())
    await userEvent.type(box(), '1234567,8')
    // The space before € is a non-breaking space in de-DE, so match loosely.
    await expect.poll(() => inputEl().value).toMatch(/^1\.234\.567,8\s€$/)
  })

  it('keeps a trailing decimal while typing', async () => {
    const onChange = vi.fn()
    await render(
      <CurrencyInput locale="en-US" currency="USD" onChange={onChange} aria-label="amount" />,
    )
    await userEvent.click(box())
    await userEvent.type(box(), '12.')
    await expect.poll(() => inputEl().value).toBe('$12.')
    expect(onChange).toHaveBeenLastCalledWith(12, expect.anything())
  })

  it('emits the parsed number on each keystroke', async () => {
    const onChange = vi.fn()
    await render(
      <CurrencyInput locale="en-US" currency="USD" onChange={onChange} aria-label="amount" />,
    )
    await userEvent.click(box())
    await userEvent.type(box(), '50000')
    expect(onChange).toHaveBeenLastCalledWith(50000, expect.objectContaining({ value: 50000 }))
  })

  it('drops the decimal key for a zero-fraction currency (JPY)', async () => {
    await render(<Controlled locale="ja-JP" currency="JPY" />)
    await userEvent.click(box())
    await userEvent.type(box(), '1234')
    await expect.poll(() => inputEl().value).toBe('￥1,234')
    await userEvent.type(box(), '.')
    await expect.poll(() => inputEl().value).toBe('￥1,234')
  })

  it('formats a negative amount live when allowNegative', async () => {
    await render(<Controlled locale="en-US" currency="USD" allowNegative />)
    await userEvent.click(box())
    await userEvent.type(box(), '-1234')
    await expect.poll(() => inputEl().value).toBe('-$1,234')
  })

  it('rejects letters mid-stream', async () => {
    await render(<Controlled locale="en-US" currency="USD" />)
    await userEvent.click(box())
    await userEvent.type(box(), '12ab34')
    await expect.poll(() => inputEl().value).toBe('$1,234')
  })
})

describe('more live behaviours', () => {
  it('steps with the arrow keys and stays formatted (controlled)', async () => {
    // Controlled so the increment flows through the parent's value.
    await render(<Controlled locale="en-US" currency="USD" initial={1234} step={1} />)
    await userEvent.click(box())
    await userEvent.keyboard('{ArrowUp}')
    await expect.poll(() => inputEl().value).toBe('$1,235')
    await userEvent.keyboard('{ArrowDown}')
    await expect.poll(() => inputEl().value).toBe('$1,234')
  })

  it('applies transformRawValue before formatting', async () => {
    await render(
      <Controlled locale="en-US" currency="USD" transformRawValue={(r) => r.replace(/_/g, '')} />,
    )
    await userEvent.click(box())
    await userEvent.type(box(), '1_234')
    await expect.poll(() => inputEl().value).toBe('$1,234')
  })

  it('clears back to an empty field', async () => {
    await render(<Controlled locale="en-US" currency="USD" />)
    await userEvent.click(box())
    await userEvent.type(box(), '5')
    await expect.poll(() => inputEl().value).toBe('$5')
    await userEvent.keyboard('{Backspace}')
    await expect.poll(() => inputEl().value).toBe('')
  })
})

describe('caret preservation', () => {
  it('lands the caret after the digit just typed at the end', async () => {
    await render(<Controlled locale="en-US" currency="USD" />)
    await userEvent.click(box())
    await userEvent.type(box(), '1234')
    // "$1,234" — caret should sit at the end (after the 4), index 6.
    await expect.poll(() => inputEl().value).toBe('$1,234')
    await expect.poll(() => inputEl().selectionStart).toBe(6)
  })

  it('keeps the caret next to the digit when inserting in the middle', async () => {
    await render(<Controlled locale="en-US" currency="USD" />)
    await userEvent.click(box())
    await userEvent.type(box(), '1234')
    // Jump to the start and insert a 9: "$91,234", caret right after the 9.
    await userEvent.keyboard('{Home}9')
    await expect.poll(() => inputEl().value).toBe('$91,234')
    // "$9|1,234" → index 2.
    await expect.poll(() => inputEl().selectionStart).toBe(2)
  })

  it('an invalid character typed mid-string leaves the value and caret untouched', async () => {
    await render(<Controlled locale="en-US" currency="USD" />)
    await userEvent.click(box())
    await userEvent.type(box(), '123456')
    await expect.poll(() => inputEl().value).toBe('$123,456')
    // "$123,|456" — park mid-string and type a letter.
    inputEl().setSelectionRange(5, 5)
    await userEvent.keyboard('x')
    await expect.poll(() => inputEl().value).toBe('$123,456')
    expect([inputEl().selectionStart, inputEl().selectionEnd]).toEqual([5, 5])
  })

  it('a second decimal separator is rejected instead of moving the decimal', async () => {
    // "1.234,56 €" (de-DE): a ',' typed mid-integer used to *reinterpret* the
    // amount as 12,34 and throw the caret to the end.
    await render(<Controlled locale="de-DE" currency="EUR" />)
    await userEvent.click(box())
    await userEvent.type(box(), '1234,56')
    await expect.poll(() => inputEl().value).toBe('1.234,56 €')
    inputEl().setSelectionRange(3, 3)
    await userEvent.keyboard(',')
    await expect.poll(() => inputEl().value).toBe('1.234,56 €')
    expect([inputEl().selectionStart, inputEl().selectionEnd]).toEqual([3, 3])
  })

  it('a decimal separator is still accepted once the existing one is gone', async () => {
    await render(<Controlled locale="en-US" currency="USD" />)
    await userEvent.click(box())
    await userEvent.type(box(), '12.5')
    await expect.poll(() => inputEl().value).toBe('$12.5')
    await userEvent.keyboard('{Backspace}{Backspace}') // back to "$12"
    await expect.poll(() => inputEl().value).toBe('$12')
    await userEvent.keyboard('.7')
    await expect.poll(() => inputEl().value).toBe('$12.7')
  })

  it('keystrokes survive a controlled host that echoes the value asynchronously', async () => {
    // A host that round-trips onChange through a later task (async store,
    // Storybook args) leaves the value prop one keystroke behind. The stale
    // echo used to rewrite the field mid-typing — dropping digits and throwing
    // the caret to the end.
    function AsyncControlled() {
      const [value, setValue] = useState<number | null>(null)
      return (
        <CurrencyInput
          locale="en-US"
          currency="USD"
          value={value}
          onChange={(next) => {
            setTimeout(() => {
              setValue(next)
            }, 40)
          }}
          aria-label="amount"
        />
      )
    }
    await render(<AsyncControlled />)
    await userEvent.click(box())
    await userEvent.type(box(), '123456')
    await expect.poll(() => inputEl().value).toBe('$123,456')
    // And the echo settling later must not rewrite the field either.
    await new Promise((resolve) => setTimeout(resolve, 120))
    expect(inputEl().value).toBe('$123,456')
    expect(inputEl().selectionStart).toBe(8)
  })

  it('blur mode still accepts keystrokes untouched by the live guard', async () => {
    await render(<Controlled locale="en-US" currency="USD" formatMode="blur" />)
    await userEvent.click(box())
    await userEvent.type(box(), '12a34')
    await expect.poll(() => inputEl().value).toBe('1234')
  })

  it('an external value set while focused reformats the field (live)', async () => {
    function WithExternalSet() {
      const [value, setValue] = useState<number | null>(5)
      return (
        <CurrencyInput
          locale="en-US"
          currency="USD"
          value={value}
          onChange={setValue}
          onFocus={() => {
            // An external set landing mid-edit (server push, another widget)
            // must reformat the field rather than being ignored.
            setTimeout(() => {
              setValue(777)
            }, 30)
          }}
          aria-label="amount"
        />
      )
    }
    await render(<WithExternalSet />)
    // The starting value is asserted *before* the click, not after. Clicking is
    // what schedules the external set, so polling for `$5` afterwards is a race
    // against that 30ms timer: on a loaded runner the first poll tick can land
    // after it has already fired, and the matcher then waits out its timeout on
    // a field that reads `$777`. That is exactly how this failed in CI —
    // `expected '$777' to be '$5'` — while passing every time locally.
    await expect.poll(() => inputEl().value).toBe('$5')
    await userEvent.click(box())
    await expect.poll(() => inputEl().value).toBe('$777')
    expect(document.activeElement).toBe(inputEl())
  })

  it('Backspace onto a group separator deletes the digit, not the separator', async () => {
    await render(<Controlled locale="en-US" currency="USD" />)
    await userEvent.click(box())
    await userEvent.type(box(), '1234') // "$1,234"
    // Move caret to just after the comma: Home, then Right x3 → index 3 ("$1,|234").
    await userEvent.keyboard('{Home}{ArrowRight}{ArrowRight}{ArrowRight}{Backspace}')
    // Deleting across the separator removes the "1": "$234".
    await expect.poll(() => inputEl().value).toBe('$234')
  })
})

describe('ref forwarding', () => {
  it('populates an object ref while driving the caret', async () => {
    function WithObjectRef() {
      const ref = useRef<HTMLInputElement | null>(null)
      const [value, setValue] = useState<number | null>(null)
      return (
        <>
          <CurrencyInput
            ref={ref}
            locale="en-US"
            currency="USD"
            value={value}
            onChange={setValue}
            aria-label="amount"
          />
          <button type="button" onClick={() => (ref.current!.value = ref.current?.value ?? '')}>
            noop
          </button>
        </>
      )
    }
    await render(<WithObjectRef />)
    await userEvent.click(box())
    await userEvent.type(box(), '1234')
    await expect.poll(() => inputEl().value).toBe('$1,234')
  })
})

describe('paste', () => {
  it('reformats a fully formatted amount pasted in', async () => {
    const onChange = vi.fn()
    await render(
      <CurrencyInput locale="fr-FR" currency="EUR" onChange={onChange} aria-label="amount" />,
    )
    await userEvent.click(box())
    const formatted = new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
    }).format(1234567.89)
    await userEvent.fill(box(), formatted)
    expect(onChange).toHaveBeenLastCalledWith(1234567.89, expect.anything())
    await expect.poll(() => inputEl().value).toMatch(/1.234.567,89/)
  })
})
