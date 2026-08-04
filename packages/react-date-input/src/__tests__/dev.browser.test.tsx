import { describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { DateInput } from '../DateInput'

/**
 * The development-diagnostics path, the render props, and the defensive edges.
 * These need a real mount: the warnings fire from an effect, and the read-only
 * guards are only observable through real key events.
 */
function segment(container: HTMLElement, type: 'day' | 'month' | 'year') {
  return container.querySelector<HTMLElement>(`[data-rdi-segment="${type}"]`)!
}

describe('onWarn', () => {
  it('reports an unparseable value', async () => {
    const onWarn = vi.fn()
    await render(
      <DateInput label="Date" locale="en-GB" defaultValue="03/01/2026" onWarn={onWarn} />,
    )
    expect(onWarn).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'value-unparseable', prop: 'defaultValue' }),
    )
  })

  it('names the controlled prop when the value is controlled', async () => {
    const onWarn = vi.fn()
    await render(
      <DateInput
        label="Date"
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
    await render(<DateInput label="Date" locale="en-GB" max="soon" onWarn={onWarn} />)
    expect(onWarn).toHaveBeenCalledWith(expect.objectContaining({ code: 'max-unparseable' }))
  })

  it('reports a date after the max as well as one before the min', async () => {
    const onWarn = vi.fn()
    await render(
      <DateInput
        label="Date"
        locale="en-GB"
        max="2026-01-01"
        defaultValue="2030-05-05"
        onWarn={onWarn}
      />,
    )
    expect(onWarn).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'value-out-of-range', received: '2030-05-05' }),
    )
    expect(onWarn.mock.calls.some(([w]) => String(w.message).includes('after'))).toBe(true)
  })

  it('warns once per distinct problem, not once per keystroke', async () => {
    const onWarn = vi.fn()
    const { container } = await render(
      <DateInput label="Date" locale="en-GB" min="oops" onWarn={onWarn} />,
    )
    segment(container, 'day').focus()
    await userEvent.keyboard('15031999')
    expect(onWarn.mock.calls.filter(([w]) => w.code === 'min-unparseable')).toHaveLength(1)
  })

  it('falls back to console.warn when no handler is supplied', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    try {
      await render(<DateInput label="Date" locale="en-GB" defaultValue="nope" />)
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('[react-date-input]'))
    } finally {
      warn.mockRestore()
    }
  })

  it('says nothing when everything is fine', async () => {
    const onWarn = vi.fn()
    // No `locale` either, so the "locale was supplied" branch is exercised in
    // its absent form.
    await render(<DateInput label="Date" defaultValue="2026-03-15" onWarn={onWarn} />)
    expect(onWarn).not.toHaveBeenCalled()
  })
})

describe('labels', () => {
  it('takes a string label as the group name', async () => {
    const { container } = await render(<DateInput label="Date of birth" locale="en-GB" />)
    const group = container.querySelector('[data-rdi-root]')!
    expect(group).toHaveAttribute('aria-label', 'Date of birth')
    expect(group).not.toHaveAttribute('aria-labelledby')
  })

  it('points at a rendered element for a node label', async () => {
    // A ReactNode cannot become an aria-label, so it is rendered off-screen and
    // referenced instead — otherwise the group would silently lose its name.
    const { container } = await render(
      <DateInput
        label={
          <>
            Date <abbr title="of birth">DOB</abbr>
          </>
        }
        locale="en-GB"
      />,
    )
    const group = container.querySelector('[data-rdi-root]')!
    const labelledBy = group.getAttribute('aria-labelledby')
    expect(labelledBy).toBeTruthy()
    expect(document.getElementById(labelledBy!)?.textContent).toContain('Date')
    expect(group).not.toHaveAttribute('aria-label')
  })

  it('has neither attribute when no label is given', async () => {
    const { container } = await render(<DateInput locale="en-GB" aria-describedby="hint" />)
    const group = container.querySelector('[data-rdi-root]')!
    expect(group).not.toHaveAttribute('aria-label')
    expect(group).not.toHaveAttribute('aria-labelledby')
  })
})

describe('renderSegment', () => {
  it('replaces the painted content while keeping the semantics', async () => {
    const { container } = await render(
      <DateInput
        label="Date"
        locale="en-GB"
        defaultValue="2026-03-15"
        renderSegment={(state) => <b data-kind={state.type}>{state.text}</b>}
      />,
    )
    const day = segment(container, 'day')
    expect(day.querySelector('b')).toHaveTextContent('15')
    // The spinbutton role and value still come from the component.
    expect(day).toHaveAttribute('role', 'spinbutton')
    expect(day).toHaveAttribute('aria-valuenow', '15')
  })

  it('receives the focused flag and the segment bounds', async () => {
    const seen: { type: string; min: number; max: number; focused: boolean }[] = []
    const { container } = await render(
      <DateInput
        label="Date"
        locale="en-GB"
        defaultValue="2024-02-15"
        renderSegment={(state) => {
          seen.push({ type: state.type, min: state.min, max: state.max, focused: state.focused })
          return state.text
        }}
      />,
    )
    segment(container, 'day').focus()
    await vi.waitFor(() => {
      expect(seen.some((entry) => entry.type === 'day' && entry.focused)).toBe(true)
    })
    const day = seen.filter((entry) => entry.type === 'day')
    expect(day.at(-1)?.max).toBe(29)
  })
})

describe('read-only', () => {
  it('refuses typed digits, not just arrow keys', async () => {
    const onChange = vi.fn()
    const { container } = await render(
      <DateInput
        label="Date"
        locale="en-GB"
        readOnly
        value="2026-03-15"
        onChange={onChange}
        onPartsChange={() => undefined}
      />,
    )
    segment(container, 'day').focus()
    await userEvent.keyboard('27')
    expect(segment(container, 'day')).toHaveTextContent('15')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('refuses Backspace', async () => {
    const { container } = await render(
      <DateInput
        label="Date"
        locale="en-GB"
        readOnly
        value="2026-03-15"
        onChange={() => undefined}
      />,
    )
    segment(container, 'month').focus()
    await userEvent.keyboard('{Backspace}')
    expect(segment(container, 'month')).toHaveTextContent('03')
  })
})

describe('controlled edges', () => {
  it('starts empty for an explicit null value', async () => {
    const { container } = await render(
      <DateInput label="Date" locale="en-GB" value={null} onChange={() => undefined} />,
    )
    expect(segment(container, 'day')).toHaveTextContent('dd')
  })
})
