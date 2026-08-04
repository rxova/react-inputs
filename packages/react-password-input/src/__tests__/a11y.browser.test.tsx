import { describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
// Static import so Vite pre-bundles axe-core with the other deps; a dynamic
// import triggers a mid-run optimize + reload that flakes the axe specs.
import axe from 'axe-core'
import { PasswordInput } from '../PasswordInput'
import { commonRules } from '../rules'

async function violations(container: HTMLElement) {
  const results = await axe.run(container, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
  })
  return results.violations.map((v) => `${v.id}: ${v.help}`)
}

describe('semantics', () => {
  it('is a real labelled form control', async () => {
    // Not a div with a contenteditable. The browser gives us keyboard support,
    // form participation and password-manager integration for free, and none of
    // those can be faithfully reimplemented in JavaScript.
    await render(<PasswordInput label="Password" name="password" />)
    // Exact: the reveal button is named "Show password", which a substring
    // match would also pick up.
    const input = page.getByLabelText('Password', { exact: true })
    await expect.element(input).toBeInTheDocument()
    await expect.element(input).toHaveAttribute('type', 'password')
  })

  it('names the reveal control as a toggle button', async () => {
    const { container } = await render(<PasswordInput label="Password" />)
    const button = container.querySelector('[data-rpi-toggle]')!
    expect(button.getAttribute('aria-pressed')).toBe('false')
    expect(button.getAttribute('aria-label')).toBe('Show password')
    // Points at the thing it controls, so the relationship is not implied by
    // visual adjacency alone.
    expect(button.getAttribute('aria-controls')).toBe(
      container.querySelector('[data-rpi-input]')!.id,
    )
  })

  it('wires invalid state to aria-invalid and data-invalid', async () => {
    const { container } = await render(
      <>
        <PasswordInput label="Password" invalid aria-describedby="err" />
        <p id="err">That password is wrong</p>
      </>,
    )
    const input = container.querySelector('[data-rpi-input]')!
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input.getAttribute('aria-describedby')).toContain('err')
    expect(container.querySelector('[data-rpi-root]')).toHaveAttribute('data-invalid')
  })

  it('merges its own describedby ids with the caller-supplied one', async () => {
    const { container } = await render(
      <>
        <PasswordInput
          label="Password"
          aria-describedby="hint"
          showStrength
          rules={[commonRules.digit]}
        />
        <p id="hint">Pick something memorable</p>
      </>,
    )
    const described = container.querySelector('[data-rpi-input]')!.getAttribute('aria-describedby')!
    const ids = described.split(' ')
    expect(ids).toContain('hint')
    // Every id resolves to an element that actually exists — a dangling
    // reference is itself a WCAG failure.
    for (const id of ids) expect(document.getElementById(id)).not.toBeNull()
  })

  it('exposes the strength meter with a name and a human-readable value', async () => {
    const { container } = await render(
      <PasswordInput label="Password" showStrength value="k4Tm9pR2wZ" onChange={() => undefined} />,
    )
    const meter = container.querySelector('[data-rpi-meter]')!
    expect(meter).toHaveAttribute('aria-label', 'Password strength')
    // The bare number reads as "2 of 4" with no unit; valuetext is the part a
    // user can act on.
    expect(meter.getAttribute('aria-valuetext')).toBeTruthy()
  })

  it('stays a disabled control rather than disappearing', async () => {
    const { container } = await render(<PasswordInput label="Password" disabled />)
    expect(container.querySelector('[data-rpi-input]')).toBeDisabled()
    // Still present in the tree, so the field does not silently vanish for a
    // screen-reader user working through the form.
    expect(container.querySelector('[data-rpi-toggle]')).toBeDisabled()
  })

  it('gives the reveal button a target big enough to hit', async () => {
    // WCAG 2.5.8 Target Size (Minimum) is 24x24 CSS pixels.
    const { container } = await render(<PasswordInput label="Password" />)
    const box = container.querySelector('[data-rpi-toggle]')!.getBoundingClientRect()
    expect(box.width).toBeGreaterThanOrEqual(24)
    expect(box.height).toBeGreaterThanOrEqual(24)
  })
})

describe('axe', () => {
  it('is clean in the default masked state', async () => {
    const { container } = await render(<PasswordInput label="Password" name="password" />)
    expect(await violations(container)).toEqual([])
  })

  it('is clean with the meter and the checklist showing', async () => {
    const { container } = await render(
      <PasswordInput
        label="Password"
        name="password"
        showStrength
        value="abc"
        onChange={() => undefined}
        rules={[commonRules.lowercase, commonRules.uppercase, commonRules.digit]}
      />,
    )
    expect(await violations(container)).toEqual([])
  })

  it('is clean while revealed', async () => {
    const { container } = await render(
      <PasswordInput label="Password" name="password" defaultValue="hunter2" defaultRevealed />,
    )
    expect(await violations(container)).toEqual([])
  })

  it('is clean in an invalid, described state', async () => {
    const { container } = await render(
      <>
        <PasswordInput label="Password" name="password" invalid aria-describedby="err" />
        <p id="err">That password is wrong</p>
      </>,
    )
    expect(await violations(container)).toEqual([])
  })

  it('is clean while disabled', async () => {
    const { container } = await render(<PasswordInput label="Password" name="password" disabled />)
    expect(await violations(container)).toEqual([])
  })
})
