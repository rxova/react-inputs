import { describe, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { useOtpInput } from '../useOtpInput'
import type { UseOtpInputOptions } from '../useOtpInput'

function input(): HTMLInputElement {
  return page.getByRole('textbox').element() as HTMLInputElement
}

/** A bare tier-4 renderer built only from the hook's prop-getters. */
function Field({
  options,
  onFocusSpy,
  onChangeSpy,
}: {
  options?: UseOtpInputOptions
  onFocusSpy?: () => void
  onChangeSpy?: () => void
}) {
  const otp = useOtpInput({ length: 4, 'aria-label': 'Code', ...options })
  return (
    <div {...otp.getContainerProps({ id: 'harness-root' })}>
      {otp.slots.map((s) => (
        <div key={s.index} {...otp.getSlotProps(s.index, { className: 'cell' })}>
          {s.char ?? (s.hasFakeCaret ? '|' : '.')}
        </div>
      ))}
      <input {...otp.getInputProps({ onFocus: onFocusSpy, onChange: onChangeSpy })} />
      <button type="button" onClick={otp.clear}>
        clear
      </button>
      <button
        type="button"
        onClick={() => {
          otp.setValue('99')
        }}
      >
        set
      </button>
      <output data-complete>{String(otp.isComplete)}</output>
    </div>
  )
}

function cells(container: HTMLElement): string[] {
  return [...container.querySelectorAll('.cell')].map((c) => c.textContent ?? '')
}

describe('useOtpInput prop-getters', () => {
  it('merges the caller onFocus without clobbering focus tracking', async () => {
    const onFocusSpy = vi.fn()
    const { container } = await render(<Field onFocusSpy={onFocusSpy} />)
    await input().focus()
    expect(onFocusSpy).toHaveBeenCalledOnce()
    // Internal focus tracking still ran: the caret shows in the first slot.
    expect(cells(container)[0]).toBe('|')
  })

  it('merges the caller onChange and still updates value', async () => {
    const onChangeSpy = vi.fn()
    const { container } = await render(<Field onChangeSpy={onChangeSpy} />)
    await input().focus()
    await userEvent.keyboard('12')
    expect(onChangeSpy).toHaveBeenCalled()
    expect(cells(container).slice(0, 2)).toEqual(['1', '2'])
  })

  it('passes caller props and state hooks through getSlotProps', async () => {
    const { container } = await render(<Field />)
    await input().focus()
    await userEvent.keyboard('1')
    const first = container.querySelector('.cell')
    expect(first).toHaveAttribute('data-rx-otp-slot')
    expect(first).toHaveAttribute('data-filled')
    expect(first).toHaveAttribute('aria-hidden', 'true')
  })

  it('exposes the container props to the caller', async () => {
    const { container } = await render(<Field />)
    await expect.element(page.getByRole('textbox')).toBeInTheDocument()
    const root = container.querySelector('[data-rx-otp-root]')
    expect(root?.id).toBe('harness-root')
  })

  it('clear() empties the value and refocuses', async () => {
    const { container } = await render(<Field />)
    await input().focus()
    await userEvent.keyboard('123')
    await page.getByRole('button', { name: 'clear' }).click()
    expect(input().value).toBe('')
    expect(cells(container)).toEqual(['|', '.', '.', '.'])
    expect(document.activeElement).toBe(input())
  })

  it('setValue() commits a sanitized value programmatically', async () => {
    const { container } = await render(<Field />)
    await expect.element(page.getByRole('textbox')).toBeInTheDocument()
    await page.getByRole('button', { name: 'set' }).click()
    expect(input().value).toBe('99')
    expect(cells(container).slice(0, 2)).toEqual(['9', '9'])
  })

  it('reports completion', async () => {
    const { container } = await render(<Field />)
    await input().focus()
    await userEvent.keyboard('1234')
    expect(container.querySelector('[data-complete]')?.textContent).toBe('true')
  })
})

/** A tier-4 harness wiring every caller handler and the disabled/readonly/invalid options. */
function FullField(props: {
  onPaste?: () => void
  onSelect?: () => void
  onKeyUp?: () => void
  onClick?: () => void
}) {
  const otp = useOtpInput({
    length: 4,
    label: 'Code',
    dir: 'rtl',
    disabled: true,
    readOnly: true,
    invalid: true,
    'aria-describedby': 'hint',
    pattern: /[0-9]/,
    ...props,
  })
  return (
    <div {...otp.getContainerProps()}>
      {otp.slots.map((s) => (
        <div key={s.index} {...otp.getSlotProps(s.index)} />
      ))}
      <input {...otp.getInputProps(props)} />
    </div>
  )
}

describe('useOtpInput option & handler branches', () => {
  it('reflects dir, describedby and invalid on the input, and state attrs on slots', async () => {
    const { container } = await render(<FullField />)
    const el = input()
    expect(el).toHaveAttribute('aria-invalid', 'true')
    expect(el).toHaveAttribute('aria-describedby', 'hint')
    expect(el).toHaveAttribute('aria-label', 'Code')
    const root = container.querySelector('[data-rx-otp-root]')
    expect(root).toHaveAttribute('dir', 'rtl')
    const slot = container.querySelector('[data-rx-otp-slot]')
    expect(slot).toHaveAttribute('data-disabled')
    expect(slot).toHaveAttribute('data-readonly')
    expect(slot).toHaveAttribute('data-invalid')
  })

  it('merges every caller handler passed to getInputProps', async () => {
    const onClick = vi.fn()
    const onSelect = vi.fn()
    const onKeyUp = vi.fn()
    const onCompositionStart = vi.fn()
    const onCompositionEnd = vi.fn()
    const onBeforeInput = vi.fn()
    function Live() {
      const otp = useOtpInput({ length: 4, label: 'Code' })
      return (
        <div {...otp.getContainerProps()}>
          <input
            {...otp.getInputProps({
              onClick,
              onSelect,
              onKeyUp,
              onBeforeInput,
              onCompositionStart,
              onCompositionEnd,
            })}
          />
        </div>
      )
    }
    await render(<Live />)
    const el = input()
    await el.focus()
    await userEvent.keyboard('12')
    await el.click()
    el.setSelectionRange(0, 1)
    el.dispatchEvent(new Event('select', { bubbles: true }))
    el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
    el.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }))
    expect(onKeyUp).toHaveBeenCalled()
    expect(onClick).toHaveBeenCalled()
    expect(onSelect).toHaveBeenCalled()
    expect(onBeforeInput).toHaveBeenCalled()
    expect(onCompositionStart).toHaveBeenCalled()
    expect(onCompositionEnd).toHaveBeenCalled()
  })
})
