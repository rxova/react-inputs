import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { OtpInput } from '../OtpInput'
import { OtpGroup } from '../OtpGroup'
import { OtpSlot } from '../OtpSlot'

/**
 * The development guard rails. A decorative miswiring must never crash a page,
 * so these warn (dev only) and render anyway — the React/Radix convention. Run
 * server-side because `runDevChecks` fires during render, not in an effect.
 */

afterEach(() => {
  vi.restoreAllMocks()
})

describe('compound index validation', () => {
  it('warns when declared slot indices do not tile [0, length)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    // Two slots for a length of 6 — under-tiled.
    const html = renderToStaticMarkup(
      <OtpInput length={6} label="Code">
        <OtpGroup>
          <OtpSlot index={0} />
          <OtpSlot index={1} />
        </OtpGroup>
      </OtpInput>,
    )
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('tile [0, 6)'))
    // ...but still renders what it was given rather than throwing.
    expect(html).toContain('data-rx-otp-slot')
  })

  it('warns on a duplicate index', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    renderToStaticMarkup(
      <OtpInput length={2} label="Code">
        <OtpSlot index={0} />
        <OtpSlot index={0} />
      </OtpInput>,
    )
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('tile [0, 2)'))
  })

  it('stays silent when indices tile exactly once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    renderToStaticMarkup(
      <OtpInput length={2} label="Code">
        <OtpSlot index={0} />
        <OtpSlot index={1} />
      </OtpInput>,
    )
    expect(warn).not.toHaveBeenCalled()
  })
})

describe('accessible-name guard', () => {
  it('warns when neither label nor aria-label is provided', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    renderToStaticMarkup(<OtpInput length={4} />)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('no accessible name'))
  })
})

describe('compound child outside a provider', () => {
  it('throws a pointed error rather than rendering a broken slot', () => {
    // Suppress React's error boundary noise for the expected throw.
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(() => renderToStaticMarkup(<OtpSlot index={0} />)).toThrow(
      'must be rendered inside <OtpInput>',
    )
  })
})
