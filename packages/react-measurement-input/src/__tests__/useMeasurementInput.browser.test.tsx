import { describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { useMeasurementInput } from '../useMeasurementInput'
import type { UseMeasurementInputOptions, UseMeasurementInputResult } from '../useMeasurementInput'

/**
 * The hook on its own, with no `MeasurementInput` around it.
 *
 * `useMeasurementInput` is published, so a consumer can build a completely
 * custom renderer on it — and parts of its surface (`clear`, `focusSegment`,
 * `base`, `amount`, `idFor`) exist for exactly that and are not reachable
 * through the default component. Untested, they would be published API that
 * happens to work.
 *
 * Every mutation goes through a real DOM event rather than a bare call, so
 * React batches and flushes it the way it would in an application.
 */

function Probe({
  onField,
  ...options
}: UseMeasurementInputOptions & { onField?: (field: UseMeasurementInputResult) => void }) {
  const field = useMeasurementInput(options)
  onField?.(field)
  const smallest = field.units[field.units.length - 1]!
  const leading = field.units[0]!
  return (
    <div onBlur={field.handleBlur}>
      {field.units.map((unit) => (
        <span
          key={unit}
          ref={(node) => {
            field.segmentRefs.current[unit] = node
          }}
          id={field.idFor(unit)}
          data-unit={unit}
          role="spinbutton"
          tabIndex={0}
          aria-label={field.nameFor(unit)}
          onFocus={(event) => {
            field.handleSegmentFocus(unit, event)
          }}
          onKeyDown={(event) => {
            if (/^[\d.,-]$/.test(event.key)) field.typeCharacter(unit, event.key)
          }}
        >
          {field.textFor(unit)}
        </span>
      ))}
      <output data-testid="value">{field.value ?? 'null'}</output>
      <output data-testid="amount">{field.amount ?? 'null'}</output>
      <output data-testid="base">{field.base ?? 'null'}</output>
      <button
        type="button"
        onClick={() => {
          field.setSegment(leading, 5)
        }}
      >
        Set leading
      </button>
      <button
        type="button"
        onClick={() => {
          field.setSegment(smallest, 11)
        }}
      >
        Set smallest
      </button>
      <button
        type="button"
        onClick={() => {
          field.clearSegment(smallest)
        }}
      >
        Clear smallest
      </button>
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
          field.step(smallest, 1)
        }}
      >
        Up
      </button>
      <button
        type="button"
        onClick={() => {
          field.step(smallest, -3)
        }}
      >
        Down three
      </button>
      {/*
       * On mousedown with the default prevented, so the button never takes
       * focus itself — otherwise the click would move focus back the instant
       * after the hook moved it.
       */}
      <button
        type="button"
        onMouseDown={(event) => {
          event.preventDefault()
          field.focusSegment(smallest)
        }}
      >
        Focus smallest
      </button>
      <button
        type="button"
        onMouseDown={(event) => {
          event.preventDefault()
          field.moveFocus(smallest, 1)
        }}
      >
        Move right
      </button>
      <button
        type="button"
        onMouseDown={(event) => {
          event.preventDefault()
          field.moveFocus(smallest, -1)
        }}
      >
        Move left
      </button>
    </div>
  )
}

/**
 * Scoped to the container and matched exactly, because several of these tests
 * render more than one probe and `Clear` is a prefix of `Clear smallest`.
 */
function press(container: HTMLElement, name: string) {
  const button = [...container.querySelectorAll('button')].find(
    (candidate) => candidate.textContent === name,
  )
  return userEvent.click(button!)
}

function output(container: HTMLElement, id: string) {
  return container.querySelector(`[data-testid="${id}"]`)?.textContent
}

function unit(container: HTMLElement, name: string) {
  return container.querySelector<HTMLElement>(`[data-unit="${name}"]`)!
}

describe('what the hook reports', () => {
  it('reports the repaired unit layout and its dimension', async () => {
    let field: UseMeasurementInputResult | null = null
    await render(
      <Probe
        units={['inch', 'foot']}
        locale="en-GB"
        onWarn={() => undefined}
        onField={(next) => {
          field = next
        }}
      />,
    )
    expect(field!.units).toEqual(['foot', 'inch'])
    expect(field!.dimension).toBe('length')
    expect(field!.precision).toBe(0)
  })

  it('reports the value three ways: canonical, smallest unit, and base unit', async () => {
    const { container } = await render(
      <Probe units={['foot', 'inch']} locale="en-GB" defaultValue="71 inch" />,
    )
    expect(output(container, 'value')).toBe('71 inch')
    expect(output(container, 'amount')).toBe('71')
    // Metres, because that is the base of the length dimension.
    expect(output(container, 'base')).toBe('1.8034')
  })

  it('reports nothing while a segment is empty', async () => {
    const { container } = await render(<Probe units={['foot', 'inch']} locale="en-GB" />)
    expect(output(container, 'value')).toBe('null')
    expect(output(container, 'amount')).toBe('null')
    expect(output(container, 'base')).toBe('null')
  })

  it('reports the pieces a custom renderer needs, in display order', async () => {
    let field: UseMeasurementInputResult | null = null
    await render(
      <Probe
        units={['foot', 'inch']}
        locale="en-GB"
        onField={(next) => {
          field = next
        }}
      />,
    )
    expect(field!.pieces.map((piece) => piece.kind)).toEqual([
      'segment',
      'literal',
      'literal',
      'segment',
      'literal',
    ])
  })

  it('reports stable ids derived from the one it was given', async () => {
    let field: UseMeasurementInputResult | null = null
    const { container } = await render(
      <Probe
        units={['foot', 'inch']}
        id="height"
        onField={(next) => {
          field = next
        }}
      />,
    )
    expect(field!.ids.group).toBe('height')
    expect(field!.ids.hidden).toBe('height-value')
    expect(container.querySelector('#height-inch')).not.toBeNull()
  })

  it('reports a range per segment and a name per unit', async () => {
    let field: UseMeasurementInputResult | null = null
    await render(
      <Probe
        units={['foot', 'inch']}
        locale="en-GB"
        onField={(next) => {
          field = next
        }}
      />,
    )
    expect(field!.rangeFor('foot')).toEqual({ min: 0, max: Infinity })
    expect(field!.rangeFor('inch')).toEqual({ min: 0, max: 11 })
    expect(field!.nameFor('foot')).toBe('feet')
  })

  it('reports out-of-range without refusing the value', async () => {
    let field: UseMeasurementInputResult | null = null
    await render(
      <Probe
        units={['foot', 'inch']}
        defaultValue="71 inch"
        min="2 meter"
        onWarn={() => undefined}
        onField={(next) => {
          field = next
        }}
      />,
    )
    expect(field!.outOfRange).toBe(true)
    expect(field!.value).toBe('71 inch')
  })

  it('drops a range nothing can satisfy rather than making the field unfillable', async () => {
    let field: UseMeasurementInputResult | null = null
    await render(
      <Probe
        units={['foot', 'inch']}
        min="2 meter"
        max="1 meter"
        onWarn={() => undefined}
        onField={(next) => {
          field = next
        }}
      />,
    )
    expect(field!.min).toBeUndefined()
    expect(field!.max).toBeUndefined()
  })
})

describe('what the hook does', () => {
  it('sets and clears one segment at a time', async () => {
    const onChange = vi.fn()
    const { container } = await render(
      <Probe units={['foot', 'inch']} locale="en-GB" onChange={onChange} />,
    )
    await press(container, 'Set leading')
    await press(container, 'Set smallest')
    expect(output(container, 'value')).toBe('71 inch')
    expect(onChange).toHaveBeenLastCalledWith('71 inch')
    await press(container, 'Clear smallest')
    expect(onChange).toHaveBeenLastCalledWith(null)
  })

  it('clears everything at once', async () => {
    const { container } = await render(
      <Probe units={['foot', 'inch']} locale="en-GB" defaultValue="71 inch" />,
    )
    await press(container, 'Clear')
    expect(output(container, 'value')).toBe('null')
    expect(unit(container, 'foot').textContent).toBe('--')
  })

  it('types one character at a time, buffering until the number is done', async () => {
    const { container } = await render(<Probe units={['foot', 'inch']} locale="en-GB" />)
    await userEvent.click(unit(container, 'inch'))
    await userEvent.keyboard('1')
    expect(unit(container, 'inch').textContent).toBe('1')
    await userEvent.keyboard('1')
    expect(unit(container, 'inch').textContent).toBe('11')
  })

  it('paints a placeholder for an empty segment', async () => {
    const { container } = await render(<Probe units={['foot', 'inch']} locale="en-GB" />)
    expect(unit(container, 'foot').textContent).toBe('--')
    expect(unit(container, 'inch').textContent).toBe('--')
  })

  it('steps a segment and clamps at its ends', async () => {
    const { container } = await render(
      <Probe units={['foot', 'inch']} locale="en-GB" defaultValue="71 inch" />,
    )
    await press(container, 'Up')
    // 11 is the ceiling; stepping up must not roll round and add a foot.
    expect(unit(container, 'inch').textContent).toBe('11')
    await press(container, 'Down three')
    expect(unit(container, 'inch').textContent).toBe('08')
  })

  it('moves focus between real DOM nodes', async () => {
    const { container } = await render(<Probe units={['foot', 'inch']} locale="en-GB" />)
    await press(container, 'Focus smallest')
    expect(document.activeElement).toBe(unit(container, 'inch'))
    // Clamped: there is nothing to the right of the last segment.
    await press(container, 'Move right')
    expect(document.activeElement).toBe(unit(container, 'inch'))
    await press(container, 'Move left')
    expect(document.activeElement).toBe(unit(container, 'foot'))
  })

  it('refuses every edit while disabled or read-only', async () => {
    for (const options of [{ disabled: true }, { readOnly: true }]) {
      const onChange = vi.fn()
      const { container } = await render(
        <Probe units={['foot', 'inch']} locale="en-GB" onChange={onChange} {...options} />,
      )
      await press(container, 'Set leading')
      await press(container, 'Up')
      expect(output(container, 'value')).toBe('null')
      expect(onChange).not.toHaveBeenCalled()
    }
  })

  it('reports every keystroke through onPartsChange, including incomplete ones', async () => {
    const onPartsChange = vi.fn()
    const { container } = await render(
      <Probe units={['foot', 'inch']} locale="en-GB" onPartsChange={onPartsChange} />,
    )
    await userEvent.click(unit(container, 'inch'))
    await userEvent.keyboard('1')
    expect(onPartsChange).toHaveBeenCalledWith({ inch: 1 })
  })

  it('carries on blur, through the hook alone', async () => {
    const { container } = await render(
      <>
        <Probe units={['foot', 'inch']} locale="en-GB" />
        <button type="button">elsewhere</button>
      </>,
    )
    await userEvent.click(unit(container, 'foot'))
    await userEvent.keyboard('00')
    await userEvent.keyboard('14')
    await press(container, 'elsewhere')
    expect([unit(container, 'foot').textContent, unit(container, 'inch').textContent]).toEqual([
      '1',
      '02',
    ])
  })
})
