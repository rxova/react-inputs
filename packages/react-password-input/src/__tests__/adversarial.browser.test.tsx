import { describe, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { useState } from 'react'
import { PasswordInput } from '../PasswordInput'
import { estimateStrength } from '../strength'
import { commonRules } from '../rules'

/**
 * Adversarial suite.
 *
 * These are not "does the happy path work" tests — the other files cover that.
 * Each one here is an attempt to break the component: hostile consumer code,
 * hostile input, and the security properties the README claims. Several of
 * these found real defects on first run; the comments say which.
 */

describe('hostile consumer callbacks', () => {
  it('survives an estimator that throws', async () => {
    // `estimate` is consumer code running on every keystroke, exactly like a
    // rule predicate — and a rule predicate that throws is already contained.
    // A throwing estimator used to take the whole field down with it, which
    // means one bad zxcvbn adapter unmounted the login form.
    const onWarn = vi.fn()
    const { container } = await render(
      <PasswordInput
        label="Password"
        showStrength
        onWarn={onWarn}
        estimate={() => {
          throw new Error('bad adapter')
        }}
      />,
    )
    await userEvent.fill(container.querySelector('[data-rpi-input]')!, 'abc')
    // The field still works; the meter falls back to the built-in estimate.
    expect(container.querySelector('[data-rpi-input]')).toHaveValue('abc')
    expect(container.querySelector('[data-rpi-meter]')).not.toBeNull()
    expect(onWarn).toHaveBeenCalledWith(expect.objectContaining({ code: 'estimate-threw' }))
  })

  it('survives a checkCompromised that throws synchronously', async () => {
    // Returning a non-promise (or throwing before returning one) used to hit
    // `.then` on `undefined` and throw inside an effect — an unrecoverable
    // render error rather than a failed lookup.
    const { container } = await render(
      <PasswordInput
        label="Password"
        checkCompromisedDelay={5}
        checkCompromised={() => {
          throw new Error('misconfigured')
        }}
      />,
    )
    await userEvent.fill(container.querySelector('[data-rpi-input]')!, 'hunter2')
    await new Promise((resolve) => setTimeout(resolve, 60))
    // Treated as "unknown", never as "safe".
    expect(container.querySelector('[data-rpi-compromised]')).toBeNull()
    expect(container.querySelector('[data-rpi-input]')).toHaveValue('hunter2')
  })

  it('does not fire onRevealChange when blur leaves an already-masked field', async () => {
    // Every blur used to report `false` whether or not anything changed, so a
    // controlled parent saw a stream of no-op updates — and any parent that
    // logged or persisted the reveal state logged one entry per blur.
    const onRevealChange = vi.fn()
    await render(
      <>
        <PasswordInput label="Password" onRevealChange={onRevealChange} />
        <button type="button">Elsewhere</button>
      </>,
    )
    await userEvent.tab()
    await page.getByRole('button', { name: 'Elsewhere' }).click()
    expect(onRevealChange).not.toHaveBeenCalled()
  })
})

describe('security properties the README claims', () => {
  it('never issues a network request of its own', async () => {
    // The whole reason `checkCompromised` is a callback: the plaintext must
    // never leave the page unless the consumer sends it deliberately.
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    try {
      const { container } = await render(
        <PasswordInput label="Password" showStrength rules={[commonRules.digit]} />,
      )
      await userEvent.fill(container.querySelector('[data-rpi-input]')!, 'hunter2!A')
      await new Promise((resolve) => setTimeout(resolve, 50))
      expect(fetchSpy).not.toHaveBeenCalled()
    } finally {
      fetchSpy.mockRestore()
    }
  })

  it('keeps the password out of every attribute while masked', async () => {
    // A password echoed into `title`, `aria-valuetext`, `placeholder` or a
    // `data-*` hook would survive in the accessibility tree and in any DOM
    // snapshot an error reporter takes.
    const secret = 'Zq7#mVx2Lp'
    const { container } = await render(
      <PasswordInput label="Password" showStrength defaultValue={secret} />,
    )
    const root = container.querySelector('[data-rpi-root]')!
    for (const element of root.querySelectorAll('*')) {
      for (const attribute of element.attributes) {
        // `value` on the input itself is the field's own state, not a leak.
        if (element.tagName === 'INPUT' && attribute.name === 'value') continue
        expect(attribute.value).not.toContain(secret)
      }
    }
    // And it is not sitting in the live region either.
    expect(root.querySelector('[data-rpi-announcement]')!.textContent).not.toContain(secret)
  })

  it('escapes markup in consumer-supplied labels instead of rendering it', async () => {
    const { container } = await render(
      <PasswordInput
        label="Password"
        capsLockLabel={'<img src=x onerror="alert(1)">'}
        defaultValue="x"
      />,
    )
    const input = container.querySelector<HTMLInputElement>('[data-rpi-input]')!
    input.focus()
    const event = new KeyboardEvent('keydown', { key: 'a', bubbles: true })
    Object.defineProperty(event, 'getModifierState', { value: () => true })
    input.dispatchEvent(event)
    await expect.element(page.getByRole('status')).toBeInTheDocument()
    // Rendered as text, not parsed as HTML.
    expect(container.querySelector('[data-rpi-caps-lock]')!.querySelector('img')).toBeNull()
  })

  it('reveals only on explicit action, never because the value changed', async () => {
    const { container } = await render(<PasswordInput label="Password" />)
    await userEvent.fill(container.querySelector('[data-rpi-input]')!, 'whatever')
    expect(container.querySelector('[data-rpi-input]')).toHaveAttribute('type', 'password')
  })
})

describe('hostile input', () => {
  it('handles a very long password without blocking the main thread', async () => {
    // Someone pastes a 100k-character file into the field. Every estimator
    // stage has to stay linear; a quadratic one freezes the tab.
    //
    // Measured as a ratio, not against a millisecond budget: this suite runs
    // beside every other package's browser tests, and a loaded machine misses
    // a fixed target while the code under test is perfectly linear. The shape
    // of the curve is the actual claim — quadratic work grows ~16x for a 4x
    // input, linear stays near 4x. The bar sits at 10 rather than at 5: under a
    // loaded machine the ratio of two short measurements drifts well past the
    // ideal 4, and the claim worth defending is "not quadratic", which would
    // land near 16x.
    //
    // Fastest of several runs, because scheduler noise only ever adds time.
    // The estimator is quick enough that a single pass over 100k characters is
    // ~1ms — short enough for one preemption to dominate the reading — so the
    // sizes below are deliberately large and sampled more often.
    const fastest = (run: () => void, repeats = 9): number => {
      let best = Infinity
      for (let index = 0; index < repeats; index += 1) {
        const started = performance.now()
        run()
        best = Math.min(best, performance.now() - started)
      }
      return best
    }

    const huge = 'aB3$'.repeat(100_000)
    const quarter = 'aB3$'.repeat(25_000)

    const growth =
      fastest(() => {
        estimateStrength(huge)
      }) /
      fastest(() => {
        estimateStrength(quarter)
      })

    expect(growth).toBeLessThan(10)
    expect(estimateStrength(huge).score).toBe(4)
  })

  it('treats blocklist entries as literal text, not as patterns', async () => {
    // `includes`, never `new RegExp(entry)`. A consumer blocklist built from
    // user-supplied strings would otherwise be both a ReDoS vector and a
    // matching bug.
    // `.*b` would match everything if it were compiled as a pattern; as
    // literal text it matches only a password that actually contains it.
    expect(estimateStrength('xK9#mQ2wLp', { blocklist: ['.*b'] }).penalties).not.toContain(
      'blocklisted',
    )
    expect(estimateStrength('a.*b9#Qz', { blocklist: ['.*b'] }).penalties).toContain('blocklisted')
    // A pathological pattern that would hang a backtracking engine.
    const evil = '(a+)+$'
    expect(() => estimateStrength('a'.repeat(2000), { blocklist: [evil] })).not.toThrow()
  })

  it('does not mistake an empty or whitespace-only userInput for a match', async () => {
    // Tokens shorter than three characters are dropped; without that, an empty
    // string would be `includes`-d by every password and score everything zero.
    const clean = estimateStrength('xK9#mQ2wLp', { userInputs: ['', '   ', 'a'] })
    expect(clean.penalties).not.toContain('contains-user-input')
    expect(clean.score).toBeGreaterThan(0)
  })

  it('counts astral characters as single characters end to end', async () => {
    // `.length` on a string of emoji is double the glyph count, so a naive
    // implementation lets a 4-glyph password satisfy an 8-character minimum.
    const { container } = await render(
      <PasswordInput label="Password" minLength={8} rules={undefined} defaultValue="🔐🔑🗝🛡" />,
    )
    expect(container.querySelector('[data-rpi-rules]')).toBeNull()
    expect(estimateStrength('🔐🔑🗝🛡', { minLength: 8 }).penalties).toContain('too-short')
  })

  it('does not let a native maxLength silently truncate a passphrase', async () => {
    // NIST requires accepting at least 64 characters. The default leaves
    // maxLength unset precisely so a long passphrase is never cut in half.
    const { container } = await render(<PasswordInput label="Password" />)
    expect(container.querySelector('[data-rpi-input]')).not.toHaveAttribute('maxlength')
  })
})

describe('state machine edges', () => {
  it('keeps the reveal toggle working while read-only', async () => {
    // Read-only means "you may not change this", not "you may not look at it".
    const { container } = await render(
      <PasswordInput label="Password" readOnly value="hunter2" onChange={() => undefined} />,
    )
    await page.getByRole('button', { name: 'Show password' }).click()
    expect(container.querySelector('[data-rpi-input]')).toHaveAttribute('type', 'text')
  })

  it('does not run the breach check for a disabled field', async () => {
    // A disabled field is not being edited by anyone, so handing its contents
    // to an outbound callback is work the user did not ask for.
    const checkCompromised = vi.fn(() => Promise.resolve(true))
    await render(
      <PasswordInput
        label="Password"
        disabled
        defaultValue="hunter2"
        checkCompromised={checkCompromised}
        checkCompromisedDelay={5}
      />,
    )
    await new Promise((resolve) => setTimeout(resolve, 60))
    expect(checkCompromised).not.toHaveBeenCalled()
  })

  it('does not re-run the estimator when only the parent re-rendered', async () => {
    // `userInputs` and `blocklist` are almost always written as inline array
    // literals, which are a new reference every render. Memoising on the
    // reference means the estimator ran on every unrelated parent update.
    const estimate = vi.fn(() => ({
      score: 2 as const,
      entropy: 40,
      penalties: [],
      effectiveLength: 8,
    }))
    function Harness() {
      const [tick, setTick] = useState(0)
      return (
        <>
          <PasswordInput
            label="Password"
            showStrength
            defaultValue="abcdefgh"
            estimate={estimate}
            userInputs={['someone@example.com']}
            blocklist={['acme']}
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
    await render(<Harness />)
    const before = estimate.mock.calls.length
    await page.getByRole('button', { name: 'Re-render' }).click()
    await page.getByRole('button', { name: 'Re-render' }).click()
    expect(estimate.mock.calls.length).toBe(before)
  })

  it('never reports a stale breach verdict after the password changes again', async () => {
    // The classic async race: a slow lookup for password A resolving after the
    // user has moved on to password B must not mark B as compromised.
    const resolvers = new Map<string, (compromised: boolean) => void>()
    const { container } = await render(
      <PasswordInput
        label="Password"
        checkCompromisedDelay={1}
        checkCompromised={(password) =>
          new Promise<boolean>((resolve) => {
            resolvers.set(password, resolve)
          })
        }
      />,
    )
    const input = container.querySelector('[data-rpi-input]')!

    await userEvent.fill(input, 'leaked-one')
    await vi.waitFor(() => {
      expect(resolvers.has('leaked-one')).toBe(true)
    })
    await userEvent.fill(input, 'fresh-two')
    await vi.waitFor(() => {
      expect(resolvers.has('fresh-two')).toBe(true)
    })

    // The stale lookup finally answers "compromised" — for a password that is
    // no longer in the field.
    resolvers.get('leaked-one')!(true)
    resolvers.get('fresh-two')!(false)
    await new Promise((resolve) => setTimeout(resolve, 40))

    expect(container.querySelector('[data-rpi-compromised]')).toBeNull()
  })
})
