import { describe, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { useDurationInput } from '../useDurationInput'
import type { UseDurationInputOptions, UseDurationInputResult } from '../useDurationInput'

/**
 * The hook on its own, with no `DurationInput` around it.
 *
 * `useDurationInput` is published, so a consumer can build a completely custom
 * renderer on it — and parts of its surface (`clear`, `focusSegment`, `seconds`)
 * exist for exactly that and are not reachable through the default component.
 * Untested, they would be published API that happens to work.
 */

function Probe({
  onField,
  ...options
}: UseDurationInputOptions & { onField?: (field: UseDurationInputResult) => void }) {
  const field = useDurationInput(options)
  onField?.(field)
  return (
    <div onBlur={field.handleBlur}>
      {field.units.map((unit) => (
        <span
          key={unit}
          ref={(node) => {
            field.segmentRefs.current[unit] = node
          }}
          data-unit={unit}
          role="spinbutton"
          tabIndex={0}
          aria-label={field.nameFor(unit)}
          onFocus={(event) => {
            field.handleSegmentFocus(unit, event)
          }}
          onKeyDown={(event) => {
            if (/^\d$/.test(event.key)) field.typeDigit(unit, event.key)
          }}
        >
          {field.parts[unit] ?? '—'}
        </span>
      ))}
      <output data-testid="value">{field.value ?? 'null'}</output>
      <output data-testid="seconds">{field.seconds ?? 'null'}</output>
      <button
        type="button"
        onClick={() => {
          field.clear()
        }}
      >
        Clear
      </button>
      <button
        type="button"
        onClick={() => {
          field.focusSegment('minute')
        }}
      >
        Focus minutes
      </button>
    </div>
  )
}

describe('useDurationInput', () => {
  it('exposes the value and the same duration in seconds', async () => {
    await render(<Probe defaultValue="PT1H30M" locale="en-GB" />)
    await expect.element(page.getByTestId('value')).toHaveTextContent('PT1H30M')
    await expect.element(page.getByTestId('seconds')).toHaveTextContent('5400')
  })

  it('reports null seconds while the duration is incomplete', async () => {
    await render(<Probe locale="en-GB" />)
    await expect.element(page.getByTestId('seconds')).toHaveTextContent('null')
  })

  it('empties every segment through clear()', async () => {
    const onChange = vi.fn()
    const { container } = await render(
      <Probe defaultValue="PT1H30M" locale="en-GB" onChange={onChange} />,
    )
    await userEvent.click(page.getByRole('button', { name: 'Clear' }))
    expect(
      Array.from(container.querySelectorAll('[data-unit]')).map((node) => node.textContent),
    ).toEqual(['—', '—'])
    expect(onChange).toHaveBeenLastCalledWith(null)
  })

  it('refuses clear() while read-only', async () => {
    const { container } = await render(<Probe value="PT1H30M" locale="en-GB" readOnly />)
    await userEvent.click(page.getByRole('button', { name: 'Clear' }))
    expect(
      Array.from(container.querySelectorAll('[data-unit]')).map((node) => node.textContent),
    ).toEqual(['1', '30'])
  })

  it('moves focus to a named segment', async () => {
    const { container } = await render(<Probe locale="en-GB" />)
    await userEvent.click(page.getByRole('button', { name: 'Focus minutes' }))
    expect(document.activeElement).toBe(container.querySelector('[data-unit="minute"]'))
  })

  it('names its segments from the locale, with a fallback Intl cannot break', async () => {
    let field: UseDurationInputResult | undefined
    await render(
      <Probe
        locale="en_US"
        onWarn={() => undefined}
        onField={(next) => {
          field = next
        }}
      />,
    )
    expect(field?.nameFor('hour')).toBe('Hours')
    expect(field?.nameFor('minute')).toBe('Minutes')
    expect(field?.nameFor('day')).toBe('Days')
    expect(field?.nameFor('second')).toBe('Seconds')
  })

  it('hands back the pieces a custom renderer needs', async () => {
    let field: UseDurationInputResult | undefined
    await render(
      <Probe
        locale="en-GB"
        units={['hour', 'minute']}
        onField={(next) => {
          field = next
        }}
      />,
    )
    expect(field?.pieces.filter((piece) => piece.kind === 'segment')).toHaveLength(2)
    expect(field?.rangeFor('hour')).toEqual({ min: 0, max: Infinity })
    expect(field?.rangeFor('minute')).toEqual({ min: 0, max: 59 })
  })

  it('carries on blur even with no DurationInput markup around it', async () => {
    const onChange = vi.fn()
    const { container } = await render(
      <Probe locale="en-GB" defaultValue="PT0S" onChange={onChange} />,
    )
    const minute = container.querySelector<HTMLElement>('[data-unit="minute"]')!
    minute.focus()
    await userEvent.keyboard('90')
    await userEvent.click(document.body)
    expect(onChange).toHaveBeenLastCalledWith('PT1H30M')
  })
})
