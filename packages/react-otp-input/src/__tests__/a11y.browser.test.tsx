import { describe, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
// Static import so Vite pre-bundles axe-core with the other deps; a dynamic
// import triggers a mid-run optimize + reload that flakes the axe specs.
import axe from 'axe-core'
import { OtpInput } from '../OtpInput'

describe('single-input semantics', () => {
  it('exposes exactly one field, named, with the code as its value', async () => {
    await render(<OtpInput length={6} value="123" label="One-time code" />)
    const box = page.getByRole('textbox', { name: 'One-time code' })
    await expect.element(box).toBeInTheDocument()
    // One field, not six — a screen reader announces "one-time code, edit text".
    expect(page.getByRole('textbox').elements()).toHaveLength(1)
  })

  it('takes an aria-label when no visible label exists', async () => {
    await render(<OtpInput length={4} aria-label="SMS code" />)
    await expect.element(page.getByRole('textbox', { name: 'SMS code' })).toBeInTheDocument()
  })

  it('hides every painted slot from the accessibility tree', async () => {
    const { container } = await render(<OtpInput length={6} value="12" label="Code" />)
    await expect.element(page.getByRole('textbox')).toBeInTheDocument()
    const slots = container.querySelectorAll('[data-rx-otp-slot]')
    expect(slots.length).toBe(6)
    for (const slot of slots) expect(slot).toHaveAttribute('aria-hidden', 'true')
  })

  it('wires invalid state to aria-invalid, data-invalid and aria-describedby', async () => {
    const { container } = await render(
      <>
        <OtpInput length={6} label="Code" invalid aria-describedby="err" />
        <p id="err">That code is wrong</p>
      </>,
    )
    const box = page.getByRole('textbox')
    await expect.element(box).toHaveAttribute('aria-invalid', 'true')
    await expect.element(box).toHaveAttribute('aria-describedby', 'err')
    expect(container.querySelector('[data-rx-otp-root]')).toHaveAttribute('data-invalid')
  })

  it('stays an exposed (disabled) field rather than disappearing', async () => {
    await render(<OtpInput length={4} value="12" disabled label="Code" />)
    await expect.element(page.getByRole('textbox', { name: 'Code' })).toBeDisabled()
  })
})

describe('CSP nonce', () => {
  it('stamps the injected caret stylesheet with the nonce', async () => {
    // Injection is once-per-document; clear it so this render performs it.
    document.getElementById('rx-otp-caret-style')?.remove()
    await render(<OtpInput length={4} label="Code" nonce="test-nonce" />)
    await expect.element(page.getByRole('textbox')).toBeInTheDocument()
    const style = document.getElementById('rx-otp-caret-style') as HTMLStyleElement | null
    expect(style?.nonce).toBe('test-nonce')
  })
})

describe('focus & caret', () => {
  it('is a single tab stop', async () => {
    await render(
      <>
        <button type="button">before</button>
        <OtpInput length={6} label="Code" />
        <button type="button">after</button>
      </>,
    )
    await page.getByRole('button', { name: 'before' }).click()
    await userEvent.tab()
    await expect.element(page.getByRole('textbox')).toHaveFocus()
    await userEvent.tab()
    await expect.element(page.getByRole('button', { name: 'after' })).toHaveFocus()
  })

  it('paints a caret in the active slot while focused', async () => {
    const { container } = await render(<OtpInput length={6} label="Code" />)
    await page.getByRole('textbox').click()
    await vi.waitFor(() => {
      expect(container.querySelector('[data-rx-otp-caret]')).not.toBeNull()
    })
  })
})

describe('axe', () => {
  async function violations(container: HTMLElement): Promise<string[]> {
    const results = await axe.run(container, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    })
    return results.violations.map((v) => `${v.id}: ${v.help}`)
  }

  it('is clean for a labelled, partially filled field', async () => {
    const { container } = await render(<OtpInput length={6} value="123" label="One-time code" />)
    await expect.element(page.getByRole('textbox')).toBeInTheDocument()
    expect(await violations(container)).toEqual([])
  })

  it('is clean when masked', async () => {
    const { container } = await render(<OtpInput length={6} value="123456" mask label="Code" />)
    await expect.element(page.getByRole('textbox')).toBeInTheDocument()
    expect(await violations(container)).toEqual([])
  })

  it('is clean in an invalid, described state', async () => {
    const { container } = await render(
      <>
        <OtpInput length={6} label="Code" invalid aria-describedby="e" />
        <p id="e">Required</p>
      </>,
    )
    await expect.element(page.getByRole('textbox')).toBeInTheDocument()
    expect(await violations(container)).toEqual([])
  })
})
