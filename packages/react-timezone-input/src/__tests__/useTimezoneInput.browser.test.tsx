import { describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { useTimezoneInput } from '../useTimezoneInput'
import type { UseTimezoneInputOptions, UseTimezoneInputResult } from '../useTimezoneInput'
import { ZONES, resolveZone } from '../zones'

/**
 * The hook on its own, with no `TimezoneInput` around it.
 *
 * `useTimezoneInput` is published precisely so a consumer can build the
 * searchable combobox this package deliberately does not ship — so parts of its
 * surface (`options`, `groups`, `local`, `offsetMinutes`) exist for that and are
 * not reachable through the bundled renderer. Untested, they would be published
 * API that happens to work.
 */

function Probe({
  onField,
  ...options
}: UseTimezoneInputOptions & { onField?: (field: UseTimezoneInputResult) => void }) {
  const field = useTimezoneInput(options)
  onField?.(field)
  return (
    <div>
      <output data-testid="value">{field.value ?? 'null'}</output>
      <output data-testid="resolved">{field.resolved ?? 'null'}</output>
      <output data-testid="offset">{field.offset ?? 'null'}</output>
      <output data-testid="minutes">{field.offsetMinutes ?? 'null'}</output>
      <output data-testid="label">{field.label ?? 'null'}</output>
      <output data-testid="count">{field.options.length}</output>
      <output data-testid="groups">{field.groups.length}</output>
      <output data-testid="local">{field.local}</output>
      <output data-testid="empty">{String(field.allowEmpty)}</output>
      <button
        type="button"
        onClick={() => {
          field.selectZone('Asia/Tokyo')
        }}
      >
        tokyo
      </button>
      <button
        type="button"
        onClick={() => {
          field.selectZone(null)
        }}
      >
        clear
      </button>
    </div>
  )
}

function out(container: HTMLElement, id: string) {
  return container.querySelector(`[data-testid="${id}"]`)?.textContent
}

function press(container: HTMLElement, name: string) {
  const button = [...container.querySelectorAll('button')].find((b) => b.textContent === name)
  return userEvent.click(button!)
}

describe('what the hook reports', () => {
  it('reports the value, the engine spelling, the offset and the name', async () => {
    const { container } = await render(
      <Probe
        value="Europe/Madrid"
        locale="en-GB"
        referenceDate={new Date(Date.UTC(2026, 0, 15))}
        onChange={() => undefined}
      />,
    )
    expect(out(container, 'value')).toBe('Europe/Madrid')
    expect(out(container, 'resolved')).toBe('Europe/Madrid')
    expect(out(container, 'offset')).toBe('+01:00')
    expect(out(container, 'minutes')).toBe('60')
    expect(out(container, 'label')).toBe('Central European Time')
  })

  /**
   * The distinction the whole package turns on: what the consumer stored versus
   * what this engine calls it. Both are reported, because a consumer building a
   * custom renderer needs the second to match an option and the first to save.
   */
  it('keeps the stored spelling while resolving to the engine one', async () => {
    const { container } = await render(
      <Probe value="Europe/Kyiv" onChange={() => undefined} onWarn={() => undefined} />,
    )
    expect(out(container, 'value')).toBe('Europe/Kyiv')
    expect(out(container, 'resolved')).toBe(resolveZone('Europe/Kyiv'))
    expect(ZONES).toContain(out(container, 'resolved'))
  })

  it('reports nothing while nothing is chosen', async () => {
    const { container } = await render(<Probe />)
    expect(out(container, 'value')).toBe('null')
    expect(out(container, 'resolved')).toBe('null')
    expect(out(container, 'offset')).toBe('null')
    expect(out(container, 'label')).toBe('null')
    // And the empty option is forced, so a renderer cannot paint a zone it
    // has not got.
    expect(out(container, 'empty')).toBe('true')
  })

  it('reports every option and every group', async () => {
    const { container } = await render(<Probe locale="en-GB" />)
    expect(Number(out(container, 'count'))).toBe(ZONES.length)
    expect(Number(out(container, 'groups'))).toBeGreaterThan(5)
  })

  it('reports one unnamed group when grouping is off', async () => {
    const { container } = await render(<Probe locale="en-GB" grouped={false} />)
    expect(out(container, 'groups')).toBe('1')
  })

  it('reports the runtime zone for a "use my zone" affordance', async () => {
    let field: UseTimezoneInputResult | null = null
    const { container } = await render(
      <Probe
        onField={(next) => {
          field = next
        }}
      />,
    )
    expect(out(container, 'local')).not.toBe('')
    expect(ZONES).toContain(resolveZone(field!.local))
  })

  it('describes each option well enough to render one without the component', async () => {
    let field: UseTimezoneInputResult | null = null
    await render(
      <Probe
        locale="en-GB"
        zones={['Europe/Madrid']}
        referenceDate={new Date(Date.UTC(2026, 6, 15))}
        onField={(next) => {
          field = next
        }}
      />,
    )
    const madrid = field!.options.find((option) => option.zone === 'Europe/Madrid')
    expect(madrid).toMatchObject({
      zone: 'Europe/Madrid',
      city: 'Madrid',
      area: 'Europe',
      label: 'Central European Time',
      offset: '+02:00',
      offsetMinutes: 120,
      unlisted: false,
    })
  })

  it('marks an option the platform does not list', async () => {
    let field: UseTimezoneInputResult | null = null
    await render(
      <Probe
        value="Etc/GMT+5"
        onChange={() => undefined}
        onWarn={() => undefined}
        onField={(next) => {
          field = next
        }}
      />,
    )
    const etc = field!.options.find((option) => option.zone === 'Etc/GMT+5')
    expect(etc?.unlisted).toBe(true)
  })
})

describe('what the hook does', () => {
  it('selects and clears, uncontrolled', async () => {
    const onChange = vi.fn()
    const { container } = await render(<Probe onChange={onChange} />)
    await press(container, 'tokyo')
    expect(out(container, 'value')).toBe('Asia/Tokyo')
    expect(onChange).toHaveBeenLastCalledWith('Asia/Tokyo')
    await press(container, 'clear')
    expect(out(container, 'value')).toBe('null')
    expect(onChange).toHaveBeenLastCalledWith(null)
  })

  it('reports but does not keep a selection while controlled', async () => {
    const onChange = vi.fn()
    const { container } = await render(<Probe value="Europe/Madrid" onChange={onChange} />)
    await press(container, 'tokyo')
    expect(onChange).toHaveBeenLastCalledWith('Asia/Tokyo')
    // The parent owns it and did not accept.
    expect(out(container, 'value')).toBe('Europe/Madrid')
  })

  it('refuses to select while disabled', async () => {
    const onChange = vi.fn()
    const { container } = await render(<Probe disabled onChange={onChange} />)
    await press(container, 'tokyo')
    expect(onChange).not.toHaveBeenCalled()
    expect(out(container, 'value')).toBe('null')
  })

  it('follows the reference date', async () => {
    const winter = await render(
      <Probe
        value="America/New_York"
        onChange={() => undefined}
        referenceDate={new Date(Date.UTC(2026, 0, 15))}
      />,
    )
    expect(out(winter.container, 'offset')).toBe('-05:00')

    const summer = await render(
      <Probe
        value="America/New_York"
        onChange={() => undefined}
        referenceDate={new Date(Date.UTC(2026, 6, 15))}
      />,
    )
    expect(out(summer.container, 'offset')).toBe('-04:00')
  })
})
