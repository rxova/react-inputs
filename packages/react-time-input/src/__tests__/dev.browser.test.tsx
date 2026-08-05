import { describe, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { useState } from 'react'
import { TimeInput } from '../TimeInput'
import { useTimeInput } from '../useTimeInput'

/**
 * The development-diagnostics path, the render props, and the defensive edges.
 * These need a real mount: the warnings fire from an effect, and the read-only
 * guards are only observable through real key events.
 */
type Seg = 'hour' | 'minute' | 'second' | 'dayPeriod'
function seg(container: HTMLElement, type: Seg) {
  return container.querySelector<HTMLElement>(`[data-rx-time-segment="${type}"]`)!
}

describe('onWarn', () => {
  it('names the controlled prop when the value is controlled', async () => {
    const onWarn = vi.fn()
    await render(
      <TimeInput
        label="T"
        locale="en-GB"
        value="nonsense"
        onChange={() => undefined}
        onWarn={onWarn}
      />,
    )
    expect(onWarn).toHaveBeenCalledWith(expect.objectContaining({ prop: 'value' }))
  })

  it('reports an unparseable max as well as an unparseable min', async () => {
    const onWarn = vi.fn()
    await render(<TimeInput label="T" locale="en-GB" max="soon" onWarn={onWarn} />)
    expect(onWarn).toHaveBeenCalledWith(expect.objectContaining({ code: 'max-unparseable' }))
  })

  it('reports a time after the max as well as one before the min', async () => {
    const onWarn = vi.fn()
    await render(
      <TimeInput label="T" locale="en-GB" max="09:00" defaultValue="17:30" onWarn={onWarn} />,
    )
    expect(onWarn.mock.calls.some(([w]) => String(w.message).includes('after'))).toBe(true)
  })

  it('reports a bad seconds step only when seconds are shown', async () => {
    const hidden = vi.fn()
    await render(<TimeInput label="T" locale="en-GB" secondStep={7} onWarn={hidden} />)
    expect(hidden.mock.calls.filter(([w]) => w.prop === 'secondStep')).toHaveLength(0)

    const shown = vi.fn()
    await render(<TimeInput label="T" locale="en-GB" showSeconds secondStep={7} onWarn={shown} />)
    expect(shown).toHaveBeenCalledWith(expect.objectContaining({ prop: 'secondStep' }))
  })

  it('warns once per distinct problem, not once per keystroke', async () => {
    const onWarn = vi.fn()
    const { container } = await render(
      <TimeInput label="T" locale="en-GB" min="oops" onWarn={onWarn} />,
    )
    seg(container, 'hour').focus()
    await userEvent.keyboard('0930')
    expect(onWarn.mock.calls.filter(([w]) => w.code === 'min-unparseable')).toHaveLength(1)
  })

  it('falls back to console.warn when no handler is supplied', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    try {
      await render(<TimeInput label="T" locale="en-GB" defaultValue="nope" />)
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('[react-time-input]'))
    } finally {
      warn.mockRestore()
    }
  })

  it('says nothing when everything is fine', async () => {
    const onWarn = vi.fn()
    // No `locale` either, so the "locale was supplied" branch is exercised in
    // its absent form.
    await render(<TimeInput label="T" defaultValue="09:30" onWarn={onWarn} />)
    expect(onWarn).not.toHaveBeenCalled()
  })
})

describe('labels', () => {
  it('takes a string label as the group name', async () => {
    const { container } = await render(<TimeInput label="Start" locale="en-GB" />)
    const group = container.querySelector('[data-rx-time-root]')!
    expect(group).toHaveAttribute('aria-label', 'Start')
    expect(group).not.toHaveAttribute('aria-labelledby')
  })

  it('points at a rendered element for a node label', async () => {
    const { container } = await render(
      <TimeInput
        label={
          <>
            Start <abbr title="time">t</abbr>
          </>
        }
        locale="en-GB"
      />,
    )
    const group = container.querySelector('[data-rx-time-root]')!
    const labelledBy = group.getAttribute('aria-labelledby')
    expect(labelledBy).toBeTruthy()
    expect(document.getElementById(labelledBy!)?.textContent).toContain('Start')
  })

  it('has neither attribute when no label is given', async () => {
    const { container } = await render(<TimeInput locale="en-GB" aria-describedby="hint" />)
    const group = container.querySelector('[data-rx-time-root]')!
    expect(group).not.toHaveAttribute('aria-label')
    expect(group).not.toHaveAttribute('aria-labelledby')
  })

  it('accepts custom placeholders', async () => {
    const { container } = await render(
      <TimeInput label="T" locale="en-US" placeholders={{ hour: 'HH', dayPeriod: 'AM/PM' }} />,
    )
    expect(seg(container, 'hour')).toHaveTextContent('HH')
    expect(seg(container, 'dayPeriod')).toHaveTextContent('AM/PM')
  })
})

describe('renderSegment', () => {
  it('replaces the painted content while keeping the semantics', async () => {
    const { container } = await render(
      <TimeInput
        label="T"
        locale="en-GB"
        defaultValue="09:30"
        renderSegment={(state) => <b data-kind={state.type}>{state.text}</b>}
      />,
    )
    const hour = seg(container, 'hour')
    expect(hour.querySelector('b')).toHaveTextContent('09')
    expect(hour).toHaveAttribute('role', 'spinbutton')
    expect(hour).toHaveAttribute('aria-valuenow', '9')
  })

  it('receives the focused flag and the segment bounds', async () => {
    const seen: { type: string; min: number; max: number; focused: boolean }[] = []
    const { container } = await render(
      <TimeInput
        label="T"
        locale="en-US"
        defaultValue="09:30"
        renderSegment={(state) => {
          seen.push({ type: state.type, min: state.min, max: state.max, focused: state.focused })
          return state.text
        }}
      />,
    )
    seg(container, 'hour').focus()
    await vi.waitFor(() => {
      expect(seen.some((entry) => entry.type === 'hour' && entry.focused)).toBe(true)
    })
    expect(seen.filter((entry) => entry.type === 'hour').at(-1)?.max).toBe(12)
  })
})

describe('arrow-down and clearing', () => {
  it('steps down as well as up, on every segment', async () => {
    const { container } = await render(
      <TimeInput label="T" locale="en-US" showSeconds defaultValue="09:30:15" />,
    )
    seg(container, 'hour').focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(seg(container, 'hour')).toHaveTextContent('08')
    seg(container, 'minute').focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(seg(container, 'minute')).toHaveTextContent('29')
    seg(container, 'second').focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(seg(container, 'second')).toHaveTextContent('14')
    seg(container, 'dayPeriod').focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(seg(container, 'dayPeriod')).toHaveTextContent('PM')
  })

  it('lands on the segment minimum when stepping an empty segment', async () => {
    const { container } = await render(<TimeInput label="T" locale="en-GB" />)
    seg(container, 'minute').focus()
    await userEvent.keyboard('{ArrowDown}')
    // First press selects the first value rather than stepping past it.
    expect(seg(container, 'minute')).toHaveTextContent('00')
  })

  it('clears the hour, which clears the day period with it', async () => {
    const { container } = await render(<TimeInput label="T" locale="en-US" defaultValue="14:30" />)
    seg(container, 'hour').focus()
    await userEvent.keyboard('{Backspace}')
    expect(seg(container, 'hour')).toHaveTextContent('hh')
    // The period is derived from the hour, so it empties too rather than
    // claiming a half the field no longer has.
    expect(seg(container, 'dayPeriod')).toHaveTextContent('--')
  })

  it('remembers a day period chosen before any hour is typed', async () => {
    const { container } = await render(<TimeInput label="T" locale="en-US" />)
    seg(container, 'dayPeriod').focus()
    await userEvent.keyboard('p')
    expect(seg(container, 'dayPeriod')).toHaveTextContent('PM')
    seg(container, 'hour').focus()
    await userEvent.keyboard('03')
    seg(container, 'minute').focus()
    await userEvent.keyboard('15')
    // 3 PM, not 3 AM: the earlier choice survived.
    expect(container.querySelector('[data-rx-time-root]')).toHaveAttribute('data-complete')
    expect(seg(container, 'dayPeriod')).toHaveTextContent('PM')
  })

  it('settles a half-typed number when focus moves to another segment', async () => {
    const onChange = vi.fn()
    const { container } = await render(
      <TimeInput label="T" locale="en-GB" defaultValue="09:30" onChange={onChange} />,
    )
    seg(container, 'hour').focus()
    await userEvent.keyboard('1')
    seg(container, 'minute').focus()
    expect(onChange).toHaveBeenLastCalledWith('01:30')
  })
})

describe('the headless hook', () => {
  it('ignores a letter that is neither AM nor PM', async () => {
    const { container } = await render(<TimeInput label="T" locale="en-US" defaultValue="09:30" />)
    seg(container, 'dayPeriod').focus()
    await userEvent.keyboard('z')
    expect(seg(container, 'dayPeriod')).toHaveTextContent('AM')
  })

  it('exposes a clear() that empties every segment at once', async () => {
    // Not wired to a key in the default renderer — Backspace clears one
    // segment — but it is public API for a custom one, so it is tested as such.
    function Harness() {
      const field = useTimeInput({ defaultValue: '14:30', locale: 'en-GB' })
      return (
        <>
          <output data-testid="value">{field.value ?? 'empty'}</output>
          <button type="button" onClick={field.clear}>
            Clear all
          </button>
        </>
      )
    }
    await render(<Harness />)
    await expect.element(page.getByTestId('value')).toHaveTextContent('14:30')
    await page.getByRole('button', { name: 'Clear all' }).click()
    await expect.element(page.getByTestId('value')).toHaveTextContent('empty')
  })
})

describe('read-only and controlled edges', () => {
  it('refuses typed digits and the day period alike', async () => {
    const onChange = vi.fn()
    const { container } = await render(
      <TimeInput
        label="T"
        locale="en-US"
        readOnly
        value="09:30"
        onChange={onChange}
        onPartsChange={() => undefined}
      />,
    )
    seg(container, 'hour').focus()
    await userEvent.keyboard('11')
    seg(container, 'dayPeriod').focus()
    await userEvent.keyboard('p')
    expect(seg(container, 'hour')).toHaveTextContent('09')
    expect(seg(container, 'dayPeriod')).toHaveTextContent('AM')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('refuses Backspace while read-only', async () => {
    const { container } = await render(
      <TimeInput label="T" locale="en-GB" readOnly value="09:30" onChange={() => undefined} />,
    )
    seg(container, 'minute').focus()
    await userEvent.keyboard('{Backspace}')
    expect(seg(container, 'minute')).toHaveTextContent('30')
  })

  it('starts empty for an explicit null value', async () => {
    const { container } = await render(
      <TimeInput label="T" locale="en-GB" value={null} onChange={() => undefined} />,
    )
    expect(seg(container, 'hour')).toHaveTextContent('hh')
  })

  it('empties when a controlled value becomes null', async () => {
    function Harness() {
      const [value, setValue] = useState<string | null>('09:30')
      return (
        <>
          <TimeInput label="T" locale="en-GB" value={value} onChange={setValue} />
          <button
            type="button"
            onClick={() => {
              setValue(null)
            }}
          >
            Clear
          </button>
        </>
      )
    }
    const { container } = await render(<Harness />)
    await page.getByRole('button', { name: 'Clear' }).click()
    expect(seg(container, 'hour')).toHaveTextContent('hh')
  })

  it('settles a half-typed number when focus leaves', async () => {
    const onChange = vi.fn()
    const { container } = await render(
      <>
        <TimeInput label="T" locale="en-GB" defaultValue="09:30" onChange={onChange} />
        <button type="button">Elsewhere</button>
      </>,
    )
    seg(container, 'hour').focus()
    await userEvent.keyboard('1')
    await page.getByRole('button', { name: 'Elsewhere' }).click()
    expect(onChange).toHaveBeenLastCalledWith('01:30')
  })
})
