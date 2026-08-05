import { describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { StrictMode, useState } from 'react'
import { PasswordInput } from '../PasswordInput'
import { usePasswordInput } from '../usePasswordInput'

/**
 * Chromium, not jsdom — and about event *sequences* rather than event handlers.
 *
 * The reveal toggle already has caret coverage, but only for a caret that sits
 * still: the existing tests place it once and toggle once. The sequences that
 * break a masked field are the repeated ones — toggling twice, toggling with a
 * *selection* rather than a caret, revealing while a breach check is in flight
 * — and the headless hook, which is public API with guards no rendered
 * component can reach.
 */
function input(container: HTMLElement) {
  return container.querySelector<HTMLInputElement>('[data-rx-password-input]')!
}
function toggle(container: HTMLElement) {
  return container.querySelector<HTMLButtonElement>('[data-rx-password-toggle]')!
}

describe('the caret across repeated reveals', () => {
  it('holds a mid-string caret through several toggles', async () => {
    /**
     * Swapping `type` between `password` and `text` re-creates the editing
     * context, and React re-syncs the controlled value after the click has
     * finished dispatching — after layout effects. One toggle can pass on the
     * layout-effect restore alone; the second is where a missing follow-up
     * shows as a caret sitting at zero.
     */
    const { container } = await render(<PasswordInput label="Password" />)
    const element = input(container)
    await userEvent.fill(element, 'correcthorse')
    element.focus()
    element.setSelectionRange(7, 7)

    for (let round = 0; round < 3; round++) {
      await userEvent.click(toggle(container))
      await vi.waitFor(() => {
        expect(document.activeElement).toBe(input(container))
      })
      expect(input(container).selectionStart).toBe(7)
      expect(input(container).selectionEnd).toBe(7)
    }
  })

  it('holds a selection, not just a collapsed caret', async () => {
    // A user who selected part of the password to retype it keeps that
    // selection across a reveal; collapsing it silently loses their place.
    const { container } = await render(<PasswordInput label="Password" />)
    const element = input(container)
    await userEvent.fill(element, 'correcthorse')
    element.focus()
    element.setSelectionRange(3, 9)

    await userEvent.click(toggle(container))
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(input(container))
    })
    expect(input(container).selectionStart).toBe(3)
    expect(input(container).selectionEnd).toBe(9)
  })

  it('does not steal focus when the field was never focused', async () => {
    const { container } = await render(<PasswordInput label="Password" defaultValue="hunter2" />)
    const other = document.createElement('button')
    other.textContent = 'elsewhere'
    document.body.append(other)
    other.focus()

    await userEvent.click(toggle(container))
    await vi.waitFor(() => {
      expect(input(container).type).toBe('text')
    })
    expect(document.activeElement).not.toBe(input(container))
    other.remove()
  })

  it('keeps typing at the caret after a reveal, not at the end', async () => {
    const { container } = await render(<PasswordInput label="Password" />)
    const element = input(container)
    await userEvent.fill(element, 'abcdef')
    element.focus()
    element.setSelectionRange(3, 3)

    await userEvent.click(toggle(container))
    await vi.waitFor(() => {
      expect(input(container).selectionStart).toBe(3)
    })
    await userEvent.keyboard('X')
    await vi.waitFor(() => {
      expect(input(container).value).toBe('abcXdef')
    })
  })
})

describe('the headless hook', () => {
  /**
   * `usePasswordInput` is exported and semver-covered, and several of its
   * guards are unreachable through the rendered component: `captureSelection`
   * with the input unfocused, `setValue` while disabled, `toggleReveal` with no
   * input mounted. Every other package in the suite has a file like this;
   * password was the one that did not.
   */
  function Harness(options: Parameters<typeof usePasswordInput>[0] = {}) {
    const state = usePasswordInput(options)
    return (
      <div>
        <input ref={state.inputRef} type={state.type} value={state.value} readOnly />
        <output data-testid="value">{state.value}</output>
        <output data-testid="revealed">{String(state.revealed)}</output>
        <output data-testid="valid">{String(state.valid)}</output>
        <output data-testid="score">{String(state.strength.score)}</output>
        <button
          type="button"
          data-testid="set"
          onClick={() => {
            state.setValue('correct horse battery staple')
          }}
        >
          set
        </button>
        <button type="button" data-testid="capture" onClick={state.captureSelection}>
          capture
        </button>
        <button type="button" data-testid="toggle" onClick={state.toggleReveal}>
          toggle
        </button>
        <button type="button" data-testid="clear" onClick={state.clear}>
          clear
        </button>
      </div>
    )
  }

  function press(container: HTMLElement, id: string) {
    container.querySelector<HTMLButtonElement>(`[data-testid="${id}"]`)!.click()
  }
  function read(container: HTMLElement, id: string) {
    return container.querySelector(`[data-testid="${id}"]`)!.textContent
  }

  it('captures nothing when the input does not hold focus', async () => {
    // The guard exists so a toggle driven from elsewhere on the page does not
    // stash a stale range and yank focus back on the next reveal.
    const { container } = await render(<Harness defaultValue="hunter2" />)
    press(container, 'capture')
    press(container, 'toggle')
    await vi.waitFor(() => {
      expect(read(container, 'revealed')).toBe('true')
    })
    expect(document.activeElement).not.toBe(container.querySelector('input'))
  })

  it('refuses setValue while disabled and while read-only', async () => {
    for (const options of [{ disabled: true }, { readOnly: true }]) {
      const { container } = await render(<Harness {...options} defaultValue="hunter2" />)
      press(container, 'set')
      await vi.waitFor(() => {
        expect(read(container, 'value')).toBe('hunter2')
      })
    }
  })

  it('reports validity and strength as the value changes', async () => {
    const { container } = await render(<Harness minLength={8} />)
    expect(read(container, 'valid')).toBe('false')

    press(container, 'set')
    await vi.waitFor(() => {
      expect(read(container, 'valid')).toBe('true')
    })
    expect(Number(read(container, 'score'))).toBeGreaterThan(2)
  })

  it('clears back to empty', async () => {
    const { container } = await render(<Harness defaultValue="hunter2" />)
    press(container, 'clear')
    await vi.waitFor(() => {
      expect(read(container, 'value')).toBe('')
    })
  })

  it('leaves a controlled value to the parent', async () => {
    function Controlled() {
      const [value, setValue] = useState('start')
      return (
        <div>
          <Harness value={value} onChange={setValue} />
          <output data-testid="mirror">{value}</output>
        </div>
      )
    }
    const { container } = await render(<Controlled />)
    press(container, 'set')
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="mirror"]')!.textContent).toBe(
        'correct horse battery staple',
      )
    })
  })
})

describe('a breach check racing the user', () => {
  /**
   * Every answer here is resolved by hand rather than by a timer.
   *
   * A `setTimeout` race encodes the outcome as "250ms is later than 10ms",
   * which stops being true the moment CI runs six browser projects at once —
   * the test then fails for a reason that has nothing to do with the component.
   * Holding the promises open and resolving them in a chosen order tests the
   * same ordering deterministically.
   */
  function deferred<T>() {
    let settle: (value: T) => void = () => undefined
    const promise = new Promise<T>((resolve) => {
      settle = resolve
    })
    return { promise, settle }
  }

  /** Let the microtask queue and one macrotask turn drain. */
  async function flush() {
    for (let turn = 0; turn < 3; turn++) {
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  }

  it('never shows a verdict for a password that is no longer in the field', async () => {
    /**
     * A slow answer for an old value must not paint, however late it lands. The
     * stale answer is resolved *last* and says "compromised", so a component
     * that failed to drop it would show the banner.
     */
    const answers = new Map<string, ReturnType<typeof deferred<boolean>>>()
    const checkCompromised = (password: string) => {
      const pending = deferred<boolean>()
      answers.set(password, pending)
      return pending.promise
    }
    const { container } = await render(
      <PasswordInput
        label="Password"
        checkCompromised={checkCompromised}
        checkCompromisedDelay={10}
      />,
    )
    const element = input(container)
    await userEvent.fill(element, 'slowone')
    await vi.waitFor(() => {
      expect(answers.has('slowone')).toBe(true)
    })
    await userEvent.fill(element, 'freshone')
    await vi.waitFor(() => {
      expect(answers.has('freshone')).toBe(true)
    })

    answers.get('freshone')!.settle(false)
    answers.get('slowone')!.settle(true)
    await flush()

    expect(container.querySelector('[data-rx-password-compromised]')).toBeNull()
  })

  it('survives a reveal while the check is in flight', async () => {
    const pending = deferred<boolean>()
    const checkCompromised = () => pending.promise
    const { container } = await render(
      <PasswordInput
        label="Password"
        checkCompromised={checkCompromised}
        checkCompromisedDelay={10}
      />,
    )
    const element = input(container)
    await userEvent.fill(element, 'hunter2')
    element.focus()
    element.setSelectionRange(3, 3)
    await userEvent.click(toggle(container))
    // The answer lands only once the reveal has already happened, so the
    // re-render it causes has to leave the restored caret alone.
    pending.settle(true)

    await vi.waitFor(() => {
      expect(container.querySelector('[data-rx-password-compromised]')).not.toBeNull()
    })
    expect(input(container).selectionStart).toBe(3)
  })
})

describe('StrictMode', () => {
  it('types, reveals and reports under a double render', async () => {
    const onChange = vi.fn()
    const { container } = await render(
      <StrictMode>
        <PasswordInput label="Password" showStrength onChange={onChange} />
      </StrictMode>,
    )
    const element = input(container)
    await userEvent.fill(element, 'correct horse')
    element.focus()
    element.setSelectionRange(4, 4)

    await userEvent.click(toggle(container))
    await vi.waitFor(() => {
      expect(input(container).type).toBe('text')
    })
    expect(input(container).selectionStart).toBe(4)
    expect(onChange).toHaveBeenLastCalledWith('correct horse')
  })
})
