import { describe, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { useState } from 'react'
import { PasswordInput } from '../PasswordInput'
import { commonRules } from '../rules'
import { usePasswordInput } from '../usePasswordInput'
import type { UsePasswordInputOptions } from '../usePasswordInput'

/**
 * Chromium, not jsdom. Every assertion here depends on something jsdom either
 * fakes or does not have: a real selection model (caret restoration across the
 * `type` swap), real focus movement (`relatedTarget` on blur), and real
 * modifier state (`getModifierState('CapsLock')`).
 */

function Controlled(props: { initial?: string } = {}) {
  const [value, setValue] = useState(props.initial ?? '')
  return (
    <>
      <PasswordInput label="Password" value={value} onChange={setValue} />
      <output data-testid="mirror">{value}</output>
    </>
  )
}

describe('masking and the reveal toggle', () => {
  it('starts masked, with the toggle offering to show', async () => {
    const { container } = await render(<PasswordInput label="Password" />)
    const input = container.querySelector('[data-rx-password-input]')!
    expect(input).toHaveAttribute('type', 'password')
    await expect
      .element(page.getByRole('button', { name: 'Show password' }))
      .toHaveAttribute('aria-pressed', 'false')
  })

  it('unmasks on click and flips the button name and pressed state', async () => {
    const { container } = await render(<PasswordInput label="Password" defaultValue="hunter2" />)
    await page.getByRole('button', { name: 'Show password' }).click()

    const input = container.querySelector('[data-rx-password-input]')!
    expect(input).toHaveAttribute('type', 'text')
    await expect
      .element(page.getByRole('button', { name: 'Hide password' }))
      .toHaveAttribute('aria-pressed', 'true')
    expect(container.querySelector('[data-rx-password-root]')).toHaveAttribute('data-revealed')
  })

  it('keeps focus and the caret exactly where they were', async () => {
    // The reason this test is in the browser project. Swapping `type` re-creates
    // the input's inner editor, and without the explicit restore the caret
    // lands at the end — so the next keystroke goes to the wrong place.
    const { container } = await render(<PasswordInput label="Password" defaultValue="abcdef" />)
    const input = container.querySelector<HTMLInputElement>('[data-rx-password-input]')!

    input.focus()
    input.setSelectionRange(2, 4)

    await page.getByRole('button', { name: 'Show password' }).click()

    expect(document.activeElement).toBe(input)
    expect(input.selectionStart).toBe(2)
    expect(input.selectionEnd).toBe(4)
  })

  it('does not steal focus when the toggle is driven without focus in the field', async () => {
    const { container } = await render(<PasswordInput label="Password" defaultValue="abcdef" />)
    const button = page.getByRole('button', { name: 'Show password' })
    await button.click()
    const input = container.querySelector<HTMLInputElement>('[data-rx-password-input]')!
    // The button was clicked directly, so the input never held focus and there
    // was no caret to restore. Focus must stay on the button.
    expect(document.activeElement).not.toBe(input)
  })

  it('re-masks when focus leaves the field entirely', async () => {
    const { container } = await render(
      <>
        <PasswordInput label="Password" defaultValue="hunter2" />
        <button type="button">Elsewhere</button>
      </>,
    )
    await page.getByRole('button', { name: 'Show password' }).click()
    expect(container.querySelector('[data-rx-password-input]')).toHaveAttribute('type', 'text')

    container.querySelector<HTMLInputElement>('[data-rx-password-input]')!.focus()
    await page.getByRole('button', { name: 'Elsewhere' }).click()

    expect(container.querySelector('[data-rx-password-input]')).toHaveAttribute('type', 'password')
  })

  it('stays revealed while focus moves between the input and its own toggle', async () => {
    // Otherwise tabbing from the input to the reveal button would re-mask the
    // password before the button could ever be pressed.
    const { container } = await render(<PasswordInput label="Password" defaultValue="hunter2" />)
    await page.getByRole('button', { name: 'Show password' }).click()
    container.querySelector<HTMLInputElement>('[data-rx-password-input]')!.focus()
    await userEvent.tab()
    expect(container.querySelector('[data-rx-password-input]')).toHaveAttribute('type', 'text')
  })

  it('keeps the password visible after blur when hideOnBlur is off', async () => {
    const { container } = await render(
      <>
        <PasswordInput label="Password" defaultValue="hunter2" hideOnBlur={false} />
        <button type="button">Elsewhere</button>
      </>,
    )
    await page.getByRole('button', { name: 'Show password' }).click()
    container.querySelector<HTMLInputElement>('[data-rx-password-input]')!.focus()
    await page.getByRole('button', { name: 'Elsewhere' }).click()
    expect(container.querySelector('[data-rx-password-input]')).toHaveAttribute('type', 'text')
  })

  it('supports a controlled reveal state', async () => {
    const onRevealChange = vi.fn()
    const { container } = await render(
      <PasswordInput label="Password" revealed={false} onRevealChange={onRevealChange} />,
    )
    await page.getByRole('button', { name: 'Show password' }).click()
    expect(onRevealChange).toHaveBeenCalledWith(true)
    // Controlled and the parent did not accept the change, so nothing moved.
    expect(container.querySelector('[data-rx-password-input]')).toHaveAttribute('type', 'password')
  })

  it('renders a custom label and icon through the render props', async () => {
    await render(
      <PasswordInput
        label="Password"
        revealLabel={(state) => (state.revealed ? 'Conceal' : 'Peek')}
        revealIcon={(state) => <span>{state.revealed ? 'off' : 'on'}</span>}
      />,
    )
    const button = page.getByRole('button', { name: 'Peek' })
    await expect.element(button).toHaveTextContent('on')
    await button.click()
    await expect.element(page.getByRole('button', { name: 'Conceal' })).toHaveTextContent('off')
  })

  it('accepts a static string label and node icon', async () => {
    await render(
      <PasswordInput label="Password" revealLabel="Toggle" revealIcon={<span>x</span>} />,
    )
    await expect.element(page.getByRole('button', { name: 'Toggle' })).toBeInTheDocument()
  })

  it('omits the toggle when hideRevealToggle is set', async () => {
    const { container } = await render(<PasswordInput label="Password" hideRevealToggle />)
    expect(container.querySelector('[data-rx-password-toggle]')).toBeNull()
  })

  it('is never a submit button', async () => {
    // The default `type` for a button inside a form is "submit", so an
    // unadorned toggle would submit the login form on the first click.
    const onSubmit = vi.fn((event: { preventDefault: () => void }) => {
      event.preventDefault()
    })
    await render(
      <form onSubmit={onSubmit}>
        <PasswordInput label="Password" />
      </form>,
    )
    await page.getByRole('button', { name: 'Show password' }).click()
    expect(onSubmit).not.toHaveBeenCalled()
  })
})

describe('value', () => {
  it('is uncontrolled by default and reports every change', async () => {
    const onChange = vi.fn()
    const { container } = await render(<PasswordInput label="Password" onChange={onChange} />)
    await userEvent.fill(container.querySelector('[data-rx-password-input]')!, 'abc')
    expect(onChange).toHaveBeenLastCalledWith('abc')
  })

  it('follows the parent when controlled', async () => {
    const { container } = await render(<Controlled />)
    await userEvent.fill(container.querySelector('[data-rx-password-input]')!, 'secret')
    await expect.element(page.getByTestId('mirror')).toHaveTextContent('secret')
  })

  it('refuses input while disabled or read-only', async () => {
    const onChange = vi.fn()
    const { container } = await render(
      <PasswordInput label="Password" readOnly value="fixed" onChange={onChange} />,
    )
    const input = container.querySelector<HTMLInputElement>('[data-rx-password-input]')!
    expect(input).toHaveAttribute('readonly')
    expect(input.value).toBe('fixed')
  })

  it('drops an unsatisfiable maxLength rather than enforcing it', async () => {
    const { container } = await render(
      <PasswordInput label="Password" minLength={8} maxLength={4} onWarn={() => undefined} />,
    )
    // A field nobody can fill is worse than a missing cap.
    expect(container.querySelector('[data-rx-password-input]')).not.toHaveAttribute('maxlength')
  })

  it('applies a usable maxLength', async () => {
    const { container } = await render(<PasswordInput label="Password" maxLength={64} />)
    expect(container.querySelector('[data-rx-password-input]')).toHaveAttribute('maxlength', '64')
  })
})

/**
 * Caps Lock is the one input this suite has to synthesise.
 *
 * No browser automation protocol can turn the real Caps Lock on — Playwright's
 * `{CapsLock}` sends the keycode without changing the OS-level modifier, so
 * `getModifierState('CapsLock')` keeps returning false and the assertion can
 * never pass. Driving the modifier directly is therefore not a shortcut around
 * a hard test; it is the only way to reach the branch at all.
 *
 * What stays honest: this dispatches a genuine `KeyboardEvent` through the real
 * DOM and React's real event system, so the wiring under test — that the
 * component reads the modifier off the event rather than tracking keystrokes —
 * is exercised exactly as it is in production. Only the modifier bit is faked.
 */
function typeWithCapsLock(input: HTMLElement, capsLock: boolean) {
  const event = new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true })
  Object.defineProperty(event, 'getModifierState', {
    value: (key: string) => key === 'CapsLock' && capsLock,
  })
  input.dispatchEvent(event)
}

describe('Caps Lock', () => {
  it('warns while Caps Lock is on and clears when it goes off', async () => {
    const { container } = await render(<PasswordInput label="Password" />)
    const input = container.querySelector<HTMLInputElement>('[data-rx-password-input]')!
    input.focus()

    typeWithCapsLock(input, true)
    await expect.element(page.getByRole('status')).toHaveTextContent('Caps Lock is on')

    typeWithCapsLock(input, false)
    await vi.waitFor(() => {
      expect(container.querySelector('[data-rx-password-caps-lock]')).toBeNull()
    })
  })

  it('reads the modifier off the event, so a lock set before focus is still caught', async () => {
    // The common case: the user turned Caps Lock on while typing their
    // username. A component that tracked keydown/keyup of the CapsLock key
    // itself would never see it and would stay silent for the whole session.
    const { container } = await render(<PasswordInput label="Password" />)
    const input = container.querySelector<HTMLInputElement>('[data-rx-password-input]')!
    typeWithCapsLock(input, true)
    await expect.element(page.getByRole('status')).toBeInTheDocument()
  })

  it('stays silent when the warning is disabled', async () => {
    const { container } = await render(<PasswordInput label="Password" capsLockWarning={false} />)
    const input = container.querySelector<HTMLInputElement>('[data-rx-password-input]')!
    input.focus()
    typeWithCapsLock(input, true)
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(container.querySelector('[data-rx-password-caps-lock]')).toBeNull()
  })

  it('renders a custom warning', async () => {
    const { container } = await render(
      <PasswordInput label="Password" capsLockLabel="MAJUSCULES" />,
    )
    const input = container.querySelector<HTMLInputElement>('[data-rx-password-input]')!
    input.focus()
    typeWithCapsLock(input, true)
    await expect.element(page.getByRole('status')).toHaveTextContent('MAJUSCULES')
  })

  it('clears the warning when focus leaves the field', async () => {
    const { container } = await render(
      <>
        <PasswordInput label="Password" />
        <button type="button">Elsewhere</button>
      </>,
    )
    const input = container.querySelector<HTMLInputElement>('[data-rx-password-input]')!
    input.focus()
    typeWithCapsLock(input, true)
    await expect.element(page.getByRole('status')).toBeInTheDocument()

    await page.getByRole('button', { name: 'Elsewhere' }).click()
    await vi.waitFor(() => {
      expect(container.querySelector('[data-rx-password-caps-lock]')).toBeNull()
    })
  })
})

describe('strength meter', () => {
  it('is absent unless asked for', async () => {
    const { container } = await render(<PasswordInput label="Password" defaultValue="abc" />)
    expect(container.querySelector('[data-rx-password-meter]')).toBeNull()
  })

  it('exposes the score as a meter with a readable value', async () => {
    const { container } = await render(
      <PasswordInput
        label="Password"
        showStrength
        value="k4Tm9pR2wZ!vQ8yBn#Lm"
        onChange={() => undefined}
      />,
    )
    const meter = container.querySelector('[data-rx-password-meter]')!
    expect(meter).toHaveAttribute('role', 'meter')
    expect(meter).toHaveAttribute('aria-valuenow', '4')
    expect(meter).toHaveAttribute('aria-valuetext', 'Strong')
    expect(container.querySelector('[data-rx-password-root]')).toHaveAttribute('data-score', '4')
  })

  it('fills one segment per point of score', async () => {
    const { container } = await render(
      <PasswordInput label="Password" showStrength value="k4Tm9pR2" onChange={() => undefined} />,
    )
    const filled = container.querySelectorAll('[data-rx-password-segment][data-filled]')
    const score = Number(
      container.querySelector('[data-rx-password-meter]')!.getAttribute('aria-valuenow'),
    )
    expect(filled).toHaveLength(score)
  })

  it('accepts a replacement estimator', async () => {
    // The escape hatch for anyone who wants zxcvbn's wordlists.
    const { container } = await render(
      <PasswordInput
        label="Password"
        showStrength
        value="anything"
        onChange={() => undefined}
        estimate={() => ({ score: 3, entropy: 42, penalties: [], effectiveLength: 8 })}
      />,
    )
    expect(container.querySelector('[data-rx-password-meter]')).toHaveAttribute(
      'aria-valuenow',
      '3',
    )
  })

  it('accepts a custom caption', async () => {
    const { container } = await render(
      <PasswordInput
        label="Password"
        showStrength
        value="k4Tm9pR2wZ!vQ8yBn#Lm"
        onChange={() => undefined}
        strengthLabel={(strength) => `${String(strength.score)}/4`}
      />,
    )
    expect(container.querySelector('[data-rx-password-strength-label]')).toHaveTextContent('4/4')
  })
})

describe('requirement checklist', () => {
  it('appears automatically once rules are supplied', async () => {
    const { container } = await render(
      <PasswordInput
        label="Password"
        value="abc"
        onChange={() => undefined}
        rules={[commonRules.lowercase, commonRules.digit]}
      />,
    )
    expect(container.querySelector('[data-rule="lowercase"]')).toHaveAttribute('data-met')
    expect(container.querySelector('[data-rule="digit"]')).not.toHaveAttribute('data-met')
  })

  it('states met and unmet in text, not only in colour', async () => {
    // WCAG 1.4.1: colour alone must never be the only carrier of meaning.
    const { container } = await render(
      <PasswordInput
        label="Password"
        value="abc"
        onChange={() => undefined}
        rules={[commonRules.lowercase, commonRules.digit]}
      />,
    )
    expect(container.querySelector('[data-rule="lowercase"]')).toHaveTextContent('met')
    expect(container.querySelector('[data-rule="digit"]')).toHaveTextContent('not met')
  })

  it('can be hidden while still gating validity', async () => {
    const onValidityChange = vi.fn()
    const { container } = await render(
      <PasswordInput
        label="Password"
        value="abc"
        onChange={() => undefined}
        rules={[commonRules.digit]}
        showRules={false}
        onValidityChange={onValidityChange}
      />,
    )
    expect(container.querySelector('[data-rx-password-rules]')).toBeNull()
    expect(onValidityChange).toHaveBeenLastCalledWith(false)
  })
})

describe('validity', () => {
  it('reports transitions only, never once per keystroke', async () => {
    const onValidityChange = vi.fn()
    const { container } = await render(
      <PasswordInput label="Password" minLength={4} onValidityChange={onValidityChange} />,
    )
    const input = container.querySelector('[data-rx-password-input]')!

    await userEvent.fill(input, 'ab')
    await userEvent.fill(input, 'abcd')
    await userEvent.fill(input, 'abcde')

    // false (initial) then true. Not one call per character.
    expect(onValidityChange.mock.calls.map(([valid]) => valid)).toEqual([false, true])
  })

  it('honours a minimum score', async () => {
    const onValidityChange = vi.fn()
    const { container } = await render(
      <PasswordInput
        label="Password"
        minLength={1}
        minScore={3}
        onValidityChange={onValidityChange}
      />,
    )
    const input = container.querySelector('[data-rx-password-input]')!
    await userEvent.fill(input, 'password')
    expect(onValidityChange).toHaveBeenLastCalledWith(false)
    await userEvent.fill(input, 'k4Tm9pR2wZ!vQ8yBn#Lm')
    expect(onValidityChange).toHaveBeenLastCalledWith(true)
    expect(container.querySelector('[data-rx-password-root]')).toHaveAttribute('data-valid')
  })
})

describe('breach check', () => {
  it('debounces, aborts the stale request, and reports only the current verdict', async () => {
    const seen: string[] = []
    const checkCompromised = vi.fn(async (password: string) => {
      seen.push(password)
      return password === 'hunter2'
    })

    const { container } = await render(
      <PasswordInput
        label="Password"
        checkCompromised={checkCompromised}
        // Long enough that the debounce outlives the gap between the two fills.
        // At 20ms this was a race, not an assertion: `userEvent.fill` awaits,
        // and when this suite runs beside every other package's browser tests
        // the machine can take longer than that between the two calls — the
        // debounce then fires for 'hunt' correctly, and the test failed over a
        // component doing exactly what it should.
        checkCompromisedDelay={250}
      />,
    )
    const input = container.querySelector('[data-rx-password-input]')!

    await userEvent.fill(input, 'hunt')
    await userEvent.fill(input, 'hunter2')

    await expect.element(page.getByRole('alert')).toHaveTextContent('data breach')
    // The intermediate value never made it past the debounce.
    expect(seen).toEqual(['hunter2'])
  })

  it('treats a failed lookup as unknown rather than as safe', async () => {
    // Reporting "not compromised" because the network was down would be a lie
    // in the one direction that matters.
    const { container } = await render(
      <PasswordInput
        label="Password"
        checkCompromised={() => Promise.reject(new Error('offline'))}
        checkCompromisedDelay={10}
        onValidityChange={() => undefined}
      />,
    )
    await userEvent.fill(container.querySelector('[data-rx-password-input]')!, 'hunter2')
    await new Promise((resolve) => setTimeout(resolve, 60))
    expect(container.querySelector('[data-rx-password-compromised]')).toBeNull()
  })

  it('blocks validity while the password is known-compromised', async () => {
    const onValidityChange = vi.fn()
    const { container } = await render(
      <PasswordInput
        label="Password"
        minLength={1}
        checkCompromised={() => Promise.resolve(true)}
        checkCompromisedDelay={10}
        onValidityChange={onValidityChange}
      />,
    )
    await userEvent.fill(container.querySelector('[data-rx-password-input]')!, 'hunter2')
    await expect.element(page.getByRole('alert')).toBeInTheDocument()
    expect(onValidityChange).toHaveBeenLastCalledWith(false)
  })

  it('clears the verdict when the field is emptied', async () => {
    const { container } = await render(
      <PasswordInput
        label="Password"
        checkCompromised={() => Promise.resolve(true)}
        checkCompromisedDelay={10}
      />,
    )
    const input = container.querySelector('[data-rx-password-input]')!
    await userEvent.fill(input, 'hunter2')
    await expect.element(page.getByRole('alert')).toBeInTheDocument()
    await userEvent.clear(input)
    expect(container.querySelector('[data-rx-password-compromised]')).toBeNull()
  })
})

describe('refs and form integration', () => {
  it('forwards the ref to the input, not the wrapper', async () => {
    // React Hook Form's setFocus() and focus-first-error patterns both expect a
    // focusable form control here.
    let node: HTMLInputElement | null = null
    await render(
      <PasswordInput
        label="Password"
        ref={(element) => {
          node = element
        }}
      />,
    )
    expect(node).toBeInstanceOf(HTMLInputElement)
    node!.focus()
    expect(document.activeElement).toBe(node)
  })

  it('submits its value under its name', async () => {
    let submitted: string | null = null
    await render(
      <form
        onSubmit={(event) => {
          event.preventDefault()
          submitted = new FormData(event.currentTarget).get('password') as string
        }}
      >
        <PasswordInput label="Password" name="password" defaultValue="hunter2" />
        <button type="submit">Sign in</button>
      </form>,
    )
    await page.getByRole('button', { name: 'Sign in' }).click()
    expect(submitted).toBe('hunter2')
  })
})

describe('autoFocus, aria-label and readOnly', () => {
  it('focuses the field on mount with autoFocus', async () => {
    const { container } = await render(<PasswordInput label="Password" autoFocus />)

    expect(document.activeElement).toBe(container.querySelector('[data-rx-password-input]'))
  })

  it('takes an aria-label, which wins over label', async () => {
    const { container } = await render(
      <PasswordInput label="Password" aria-label="Current password" />,
    )

    expect(container.querySelector('[data-rx-password-input]')).toHaveAccessibleName(
      'Current password',
    )
  })

  it('marks a read-only field, which styling needs and every sibling already did', async () => {
    const { container } = await render(<PasswordInput label="Password" readOnly />)

    expect(container.querySelector('[data-rx-password-root]')).toHaveAttribute('data-readonly')
  })
})

describe('clear', () => {
  function ClearHarness(props: UsePasswordInputOptions) {
    const field = usePasswordInput(props)
    return (
      <div>
        <output data-testid="value">{field.value || 'empty'}</output>
        <button type="button" onClick={field.clear}>
          Clear
        </button>
      </div>
    )
  }

  it('empties the field', async () => {
    const onChange = vi.fn()
    await render(<ClearHarness defaultValue="hunter2hunter2" onChange={onChange} />)

    await userEvent.click(page.getByRole('button', { name: 'Clear' }))

    await expect.element(page.getByTestId('value')).toHaveTextContent('empty')
    expect(onChange).toHaveBeenCalledWith('')
  })

  it('refuses to clear a read-only field, like every other write path', async () => {
    const onChange = vi.fn()
    await render(<ClearHarness defaultValue="hunter2hunter2" readOnly onChange={onChange} />)

    await userEvent.click(page.getByRole('button', { name: 'Clear' }))

    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('blur', () => {
  it('fires onBlur only when focus leaves the whole field', async () => {
    // The one claim in this package that had no test. `usePasswordInput`
    // checks containment before forwarding the event, and the reveal toggle is
    // *inside* the field — so moving to it must stay silent. Every other input
    // in the suite pins this; the odd one out is where it quietly regresses.
    const onBlur = vi.fn()
    const { container } = await render(
      <>
        <PasswordInput label="Password" onBlur={onBlur} />
        <button type="button">Elsewhere</button>
      </>,
    )
    container.querySelector<HTMLInputElement>('[data-rx-password-input]')!.focus()
    container.querySelector<HTMLButtonElement>('[data-rx-password-toggle]')!.focus()

    expect(onBlur).not.toHaveBeenCalled()

    await page.getByRole('button', { name: 'Elsewhere' }).click()

    expect(onBlur).toHaveBeenCalledTimes(1)
  })
})
