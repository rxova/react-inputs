import { describe, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { useState } from 'react'
import { TimezoneInput } from '../TimezoneInput'
import { ZONES, resolveZone } from '../zones'

/**
 * Chromium, not jsdom. A native `<select>` with 419 options and `<optgroup>`
 * nesting is exactly the thing jsdom models least faithfully — option grouping,
 * the change event and `selectedIndex` all behave differently there — and this
 * component is mostly a bet on the native element being right.
 */

function select(container: HTMLElement) {
  return container.querySelector<HTMLSelectElement>('[data-rx-timezone-select]')!
}

describe('the option list', () => {
  it('renders every zone, grouped by area', async () => {
    const { container } = await render(<TimezoneInput label="Time zone" locale="en-GB" />)
    const element = select(container)
    // 419 zones plus the empty option.
    expect(element.options.length).toBe(ZONES.length + 1)
    expect(container.querySelectorAll('optgroup').length).toBeGreaterThan(5)
  })

  it('puts UTC first, which the platform list does not contain at all', async () => {
    const { container } = await render(<TimezoneInput label="Time zone" locale="en-GB" />)
    const values = [...select(container).options].map((option) => option.value)
    expect(values[0]).toBe('')
    expect(values[1]).toBe('UTC')
  })

  it('can render a flat list when asked', async () => {
    const { container } = await render(
      <TimezoneInput label="Time zone" locale="en-GB" grouped={false} />,
    )
    expect(container.querySelectorAll('optgroup').length).toBe(0)
    expect(select(container).options.length).toBe(ZONES.length + 1)
  })

  it('narrows to the zones it is given', async () => {
    const { container } = await render(
      <TimezoneInput
        label="Time zone"
        locale="en-GB"
        zones={['Europe/Madrid', 'America/New_York']}
      />,
    )
    const values = [...select(container).options].map((option) => option.value).filter(Boolean)
    // UTC is always available on top of whatever was asked for.
    expect(new Set(values)).toEqual(new Set(['UTC', 'Europe/Madrid', 'America/New_York']))
  })

  /**
   * The city leads so that a native select's type-ahead can reach it — the
   * option text is the only thing that search matches against.
   */
  it('labels each option with its city first', async () => {
    const { container } = await render(
      <TimezoneInput label="Time zone" locale="en-GB" zones={['Europe/Madrid']} />,
    )
    const madrid = [...select(container).options].find((o) => o.value === 'Europe/Madrid')
    expect(madrid?.textContent).toMatch(/^Madrid/)
    expect(madrid?.textContent).toContain('Central European Time')
  })
})

describe('selecting', () => {
  it('reports the IANA id', async () => {
    const onChange = vi.fn()
    const { container } = await render(
      <TimezoneInput label="Time zone" locale="en-GB" onChange={onChange} />,
    )
    await userEvent.selectOptions(select(container), 'Europe/Madrid')
    expect(onChange).toHaveBeenLastCalledWith('Europe/Madrid')
  })

  it('reports null when the empty option is chosen', async () => {
    const onChange = vi.fn()
    const { container } = await render(
      <TimezoneInput
        label="Time zone"
        locale="en-GB"
        defaultValue="Europe/Madrid"
        allowEmpty
        onChange={onChange}
      />,
    )
    await userEvent.selectOptions(select(container), '')
    expect(onChange).toHaveBeenLastCalledWith(null)
  })

  it('keeps an uncontrolled selection', async () => {
    const { container } = await render(<TimezoneInput label="Time zone" locale="en-GB" />)
    await userEvent.selectOptions(select(container), 'Asia/Tokyo')
    expect(select(container).value).toBe('Asia/Tokyo')
  })

  it('follows a controlled value written from outside', async () => {
    function Harness() {
      const [zone, setZone] = useState<string | null>('Europe/Madrid')
      return (
        <>
          <TimezoneInput label="Time zone" locale="en-GB" value={zone} onChange={setZone} />
          <button
            type="button"
            onClick={() => {
              setZone('Asia/Tokyo')
            }}
          >
            tokyo
          </button>
        </>
      )
    }
    const { container } = await render(<Harness />)
    expect(select(container).value).toBe('Europe/Madrid')
    await userEvent.click(page.getByRole('button', { name: 'tokyo' }))
    expect(select(container).value).toBe('Asia/Tokyo')
  })
})

/**
 * Problem 2, from the outside. Whichever spelling this engine lists, the other
 * one has to select the same option — that is the difference between a field
 * that works with your database and one that silently looks empty.
 */
describe('a value spelled differently from the engine', () => {
  it('selects the right option for a renamed zone', async () => {
    for (const spelling of ['Europe/Kyiv', 'Europe/Kiev']) {
      const { container } = await render(
        <TimezoneInput
          label="Time zone"
          locale="en-GB"
          value={spelling}
          onChange={() => undefined}
          onWarn={() => undefined}
        />,
      )
      expect(select(container).value).toBe(resolveZone(spelling))
      expect(select(container).value).not.toBe('')
    }
  })

  it('selects the right option for a legacy shorthand', async () => {
    const { container } = await render(
      <TimezoneInput
        label="Time zone"
        locale="en-GB"
        value="US/Eastern"
        onChange={() => undefined}
        onWarn={() => undefined}
      />,
    )
    expect(select(container).value).toBe('America/New_York')
  })
})

describe('offsets', () => {
  it('shows the offsets that apply at the reference date', async () => {
    const winter = await render(
      <TimezoneInput
        label="Time zone"
        locale="en-GB"
        zones={['America/New_York']}
        referenceDate={new Date(Date.UTC(2026, 0, 15))}
      />,
    )
    expect(winter.container.textContent).toContain('-05:00')

    const summer = await render(
      <TimezoneInput
        label="Time zone"
        locale="en-GB"
        zones={['America/New_York']}
        referenceDate={new Date(Date.UTC(2026, 6, 15))}
      />,
    )
    expect(summer.container.textContent).toContain('-04:00')
  })
})

describe('states', () => {
  it('refuses every edit while disabled', async () => {
    const onChange = vi.fn()
    const { container } = await render(
      <TimezoneInput
        label="Time zone"
        locale="en-GB"
        disabled
        defaultValue="UTC"
        onChange={onChange}
      />,
    )
    expect(select(container).disabled).toBe(true)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('marks itself complete only once a zone is chosen', async () => {
    const { container } = await render(<TimezoneInput label="Time zone" locale="en-GB" />)
    const root = container.querySelector('[data-rx-timezone-root]')!
    expect(root.hasAttribute('data-complete')).toBe(false)
    await userEvent.selectOptions(select(container), 'UTC')
    expect(root.hasAttribute('data-complete')).toBe(true)
  })

  it('fires blur and focus', async () => {
    const onBlur = vi.fn()
    const onFocus = vi.fn()
    const { container } = await render(
      <>
        <TimezoneInput label="Time zone" locale="en-GB" onBlur={onBlur} onFocus={onFocus} />
        <button type="button">elsewhere</button>
      </>,
    )
    select(container).focus()
    expect(onFocus).toHaveBeenCalled()
    await userEvent.click(page.getByRole('button', { name: 'elsewhere' }))
    expect(onBlur).toHaveBeenCalled()
  })
})

describe('form integration', () => {
  it('posts the id through the select itself, with no hidden input', async () => {
    const { container } = await render(
      <form>
        <TimezoneInput label="Time zone" locale="en-GB" name="zone" defaultValue="Europe/Madrid" />
      </form>,
    )
    const form = container.querySelector('form')!
    expect(new FormData(form).get('zone')).toBe('Europe/Madrid')
    expect(container.querySelector('input[type="hidden"]')).toBeNull()
  })
})
