import { describe, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { TimezoneInput } from '../TimezoneInput'

/**
 * Accessibility here is almost entirely a question of *not* reimplementing
 * anything.
 *
 * A native `<select>` already is a listbox: it has the role, the keyboard
 * contract, the announced value, the grouping semantics and the platform picker
 * on touch. So these tests are less "did we build the ARIA correctly" and more
 * "did we stay out of the way" — the failure mode for this component is someone
 * replacing it with a `<div role="listbox">` and losing all of it at once.
 */

function select(container: HTMLElement) {
  return container.querySelector<HTMLSelectElement>('[data-rx-timezone-select]')!
}

describe('semantics', () => {
  it('is a real select, with the role the platform gives it', async () => {
    const { container } = await render(
      <TimezoneInput label="Time zone" locale="en-GB" zones={['UTC', 'Europe/Madrid']} />,
    )
    const element = select(container)
    expect(element.tagName).toBe('SELECT')
    // Not a div with a role bolted on.
    expect(container.querySelector('[role="listbox"]')).toBeNull()
    expect(page.getByRole('combobox', { name: 'Time zone' })).toBeDefined()
  })

  it('names itself from a string label', async () => {
    const { container } = await render(<TimezoneInput label="Time zone" locale="en-GB" />)
    expect(select(container).getAttribute('aria-label')).toBe('Time zone')
  })

  it('points at a node for a label that is not a string', async () => {
    const { container } = await render(
      <TimezoneInput label={<span>Your time zone</span>} locale="en-GB" />,
    )
    const id = select(container).getAttribute('aria-labelledby')
    expect(id).not.toBeNull()
    expect(container.querySelector(`#${CSS.escape(id ?? '')}`)?.textContent).toBe('Your time zone')
  })

  it('groups the options so a screen reader announces the area', async () => {
    const { container } = await render(<TimezoneInput label="Time zone" locale="en-GB" />)
    const groups = [...container.querySelectorAll('optgroup')]
    expect(groups.length).toBeGreaterThan(5)
    for (const group of groups) expect(group.getAttribute('label')).not.toBe('')
  })

  it('carries invalid, required, disabled and a description through', async () => {
    const { container } = await render(
      <>
        <TimezoneInput label="Time zone" locale="en-GB" invalid required aria-describedby="hint" />
        <p id="hint">Pick the zone the event happens in.</p>
      </>,
    )
    const element = select(container)
    expect(element.getAttribute('aria-invalid')).toBe('true')
    expect(element.required).toBe(true)
    expect(element.getAttribute('aria-describedby')).toBe('hint')

    const disabled = await render(<TimezoneInput label="Time zone" locale="en-GB" disabled />)
    expect(select(disabled.container).disabled).toBe(true)
  })

  it('gives every option text, so none is an invisible row', async () => {
    const { container } = await render(<TimezoneInput label="Time zone" locale="en-GB" />)
    for (const option of select(container).options) {
      expect(option.textContent?.trim()).not.toBe('')
    }
  })
})

describe('keyboard and focus', () => {
  it('takes focus from Tab and gives it back', async () => {
    const { container } = await render(
      <>
        <button type="button">before</button>
        <TimezoneInput label="Time zone" locale="en-GB" zones={['UTC', 'Europe/Madrid']} />
        <button type="button">after</button>
      </>,
    )
    await userEvent.click(page.getByRole('button', { name: 'before' }))
    await userEvent.tab()
    expect(document.activeElement).toBe(select(container))
    await userEvent.tab()
    expect(document.activeElement).toBe(page.getByRole('button', { name: 'after' }).element())
  })

  it('is skipped by Tab while disabled', async () => {
    const { container } = await render(
      <>
        <button type="button">before</button>
        <TimezoneInput label="Time zone" locale="en-GB" disabled />
        <button type="button">after</button>
      </>,
    )
    await userEvent.click(page.getByRole('button', { name: 'before' }))
    await userEvent.tab()
    expect(document.activeElement).not.toBe(select(container))
  })

  /**
   * There is no caret here to jump, which is the point: a segmented field has to
   * manage one and a `<select>` does not. What it has instead is the platform's
   * own value-cycling contract, and these are the keys it is required to honour.
   */
  it('changes the selection with the arrow keys', async () => {
    const onChange = vi.fn()
    const { container } = await render(
      <TimezoneInput
        label="Time zone"
        locale="en-GB"
        zones={['UTC', 'Europe/Madrid', 'Asia/Tokyo']}
        grouped={false}
        defaultValue="UTC"
        onChange={onChange}
      />,
    )
    const element = select(container)
    element.focus()
    expect(document.activeElement).toBe(element)

    await userEvent.keyboard('{ArrowDown}')
    expect(element.value).not.toBe('UTC')
    expect(onChange).toHaveBeenCalled()

    const afterDown = element.value
    await userEvent.keyboard('{ArrowUp}')
    expect(element.value).not.toBe(afterDown)
  })

  it('jumps to the ends with Home and End', async () => {
    const { container } = await render(
      <TimezoneInput
        label="Time zone"
        locale="en-GB"
        zones={['UTC', 'Europe/Madrid', 'Asia/Tokyo']}
        grouped={false}
        defaultValue="Europe/Madrid"
        onChange={() => undefined}
      />,
    )
    const element = select(container)
    element.focus()
    await userEvent.keyboard('{End}')
    const last = element.value
    await userEvent.keyboard('{Home}')
    expect(element.value).not.toBe(last)
  })

  it('fires focus and blur exactly once each as focus passes through', async () => {
    const onFocus = vi.fn()
    const onBlur = vi.fn()
    const { container } = await render(
      <>
        <TimezoneInput label="Time zone" locale="en-GB" onFocus={onFocus} onBlur={onBlur} />
        <button type="button">after</button>
      </>,
    )
    select(container).focus()
    expect(onFocus).toHaveBeenCalledTimes(1)
    expect(onBlur).not.toHaveBeenCalled()

    await userEvent.click(page.getByRole('button', { name: 'after' }))
    expect(onBlur).toHaveBeenCalledTimes(1)
    expect(onFocus).toHaveBeenCalledTimes(1)
  })

  it('does not fire blur while focus stays on the field', async () => {
    const onBlur = vi.fn()
    const { container } = await render(
      <TimezoneInput
        label="Time zone"
        locale="en-GB"
        zones={['UTC', 'Europe/Madrid']}
        grouped={false}
        onBlur={onBlur}
      />,
    )
    const element = select(container)
    element.focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(onBlur).not.toHaveBeenCalled()
  })
})
