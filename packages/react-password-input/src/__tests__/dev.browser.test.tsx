import { describe, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { useRef, useState } from 'react'
import { PasswordInput } from '../PasswordInput'
import { commonRules } from '../rules'

/**
 * The development-diagnostics path and the defensive edges of the hook.
 *
 * These live in the browser project rather than node because every one of them
 * needs a real mount: the warnings fire from an effect, the ref callback needs a
 * real element, and the async cancellation paths need a real unmount.
 */
describe('onWarn', () => {
  it('reports a negative minLength and keeps the field usable', async () => {
    const onWarn = vi.fn()
    const { container } = await render(
      <PasswordInput label="Password" minLength={-4} onWarn={onWarn} />,
    )
    expect(onWarn).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'min-length-negative', prop: 'minLength' }),
    )
    // Coerced, not crashed: the field still renders with the default floor.
    expect(container.querySelector('[data-rx-password-input]')).toHaveAttribute('minlength', '8')
  })

  it('reports a fractional minLength', async () => {
    const onWarn = vi.fn()
    await render(<PasswordInput label="Password" minLength={8.5} onWarn={onWarn} />)
    expect(onWarn).toHaveBeenCalledWith(expect.objectContaining({ code: 'min-length-non-integer' }))
  })

  it('reports an unsatisfiable maxLength', async () => {
    const onWarn = vi.fn()
    await render(<PasswordInput label="Password" minLength={8} maxLength={4} onWarn={onWarn} />)
    expect(onWarn).toHaveBeenCalledWith(expect.objectContaining({ code: 'max-length-below-min' }))
  })

  it('reports duplicate rule ids', async () => {
    const onWarn = vi.fn()
    await render(
      <PasswordInput
        label="Password"
        rules={[commonRules.digit, { ...commonRules.symbol, id: 'digit' }]}
        onWarn={onWarn}
      />,
    )
    expect(onWarn).toHaveBeenCalledWith(expect.objectContaining({ code: 'duplicate-rule-id' }))
  })

  it('reports an autocomplete that would break password managers', async () => {
    const onWarn = vi.fn()
    await render(<PasswordInput label="Password" autoComplete="off" onWarn={onWarn} />)
    expect(onWarn).toHaveBeenCalledWith(expect.objectContaining({ code: 'autocomplete-missing' }))
  })

  it('falls back to console.warn when no handler is supplied', async () => {
    // The library ships no console noise in production — this path is
    // development-only and is dropped from production builds entirely.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    try {
      await render(<PasswordInput label="Password" minLength={-1} />)
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('[react-password-input]'))
    } finally {
      warn.mockRestore()
    }
  })

  it('warns once per instance, not once per keystroke', async () => {
    const onWarn = vi.fn()
    const { container } = await render(
      <PasswordInput label="Password" minLength={-1} onWarn={onWarn} />,
    )
    await userEvent.fill(container.querySelector('[data-rx-password-input]')!, 'abcdef')
    expect(onWarn.mock.calls.filter(([w]) => w.code === 'min-length-negative')).toHaveLength(1)
  })
})

describe('refs', () => {
  it('populates an object ref as well as a callback ref', async () => {
    function Harness() {
      const ref = useRef<HTMLInputElement>(null)
      const [tag, setTag] = useState('none')
      return (
        <>
          <PasswordInput label="Password" ref={ref} />
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
})

describe('edges', () => {
  it('omits the native minlength when the floor is zero', async () => {
    const { container } = await render(<PasswordInput label="Password" minLength={0} />)
    expect(container.querySelector('[data-rx-password-input]')).not.toHaveAttribute('minlength')
  })

  it('omits aria-valuetext when the caption is not a plain string', async () => {
    // aria-valuetext takes a string. A caller returning an element gets the
    // element rendered as the visible caption and no attribute, rather than
    // "[object Object]" read aloud.
    const { container } = await render(
      <PasswordInput
        label="Password"
        showStrength
        value="abc"
        onChange={() => undefined}
        strengthLabel={() => <strong>Weak-ish</strong>}
      />,
    )
    const meter = container.querySelector('[data-rx-password-meter]')!
    expect(meter).not.toHaveAttribute('aria-valuetext')
    expect(container.querySelector('[data-rx-password-strength-label]')).toHaveTextContent(
      'Weak-ish',
    )
  })

  it('ignores writes while disabled', async () => {
    const onChange = vi.fn()
    const { container } = await render(
      <PasswordInput label="Password" disabled onChange={onChange} />,
    )
    const input = container.querySelector<HTMLInputElement>('[data-rx-password-input]')!
    // The DOM refuses the keystroke, and the hook refuses it again — the
    // headless path has no `disabled` attribute to lean on.
    expect(input).toBeDisabled()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('restores the caret when the toggle is activated without a pointer', async () => {
    // No mousedown, so nothing captured the selection ahead of time and the
    // hook falls back to reading it live.
    const { container } = await render(<PasswordInput label="Password" defaultValue="abcdef" />)
    const input = container.querySelector<HTMLInputElement>('[data-rx-password-input]')!
    const button = container.querySelector<HTMLButtonElement>('[data-rx-password-toggle]')!
    input.focus()
    input.setSelectionRange(1, 3)
    button.click()
    await vi.waitFor(() => {
      expect(input.type).toBe('text')
    })
    expect(input.selectionStart).toBe(1)
    expect(input.selectionEnd).toBe(3)
  })

  it('does not re-announce validity when nothing about it changed', async () => {
    // The handler identity changes on every render here, so the effect re-runs
    // on each keystroke. It must still only report actual transitions.
    const seen: boolean[] = []
    function Harness() {
      const [value, setValue] = useState('')
      return (
        <PasswordInput
          label="Password"
          minLength={2}
          value={value}
          onChange={setValue}
          onValidityChange={(valid) => {
            seen.push(valid)
          }}
        />
      )
    }
    const { container } = await render(<Harness />)
    const input = container.querySelector('[data-rx-password-input]')!
    await userEvent.fill(input, 'ab')
    await userEvent.fill(input, 'abc')
    await userEvent.fill(input, 'abcd')
    expect(seen).toEqual([false, true])
  })

  it('announces that a breach check is running', async () => {
    const { container } = await render(
      <PasswordInput
        label="Password"
        checkCompromised={() => new Promise(() => undefined)}
        checkCompromisedDelay={10}
      />,
    )
    await userEvent.fill(container.querySelector('[data-rx-password-input]')!, 'hunter2')
    await vi.waitFor(() => {
      expect(container.querySelector('[data-rx-password-announcement]')).toHaveTextContent(
        'Checking password',
      )
    })
  })
})

describe('unmounting mid-check', () => {
  it('drops a resolution that arrives after unmount', async () => {
    let settle: ((compromised: boolean) => void) | undefined
    const screen = await render(
      <PasswordInput
        label="Password"
        defaultValue="hunter2"
        checkCompromised={() =>
          new Promise<boolean>((resolve) => {
            settle = resolve
          })
        }
        checkCompromisedDelay={1}
      />,
    )
    await vi.waitFor(() => {
      expect(settle).toBeDefined()
    })
    void screen.unmount()
    // Resolving into an unmounted component must not throw or warn about
    // setting state on a dead tree.
    settle?.(true)
    await new Promise((resolve) => setTimeout(resolve, 20))
  })

  it('drops a rejection that arrives after unmount', async () => {
    let fail: ((error: Error) => void) | undefined
    const screen = await render(
      <PasswordInput
        label="Password"
        defaultValue="hunter2"
        checkCompromised={() =>
          new Promise<boolean>((_resolve, reject) => {
            fail = reject
          })
        }
        checkCompromisedDelay={1}
      />,
    )
    await vi.waitFor(() => {
      expect(fail).toBeDefined()
    })
    void screen.unmount()
    fail?.(new Error('offline'))
    await new Promise((resolve) => setTimeout(resolve, 20))
  })
})
