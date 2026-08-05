import { describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
// Static import so Vite pre-bundles axe-core with the other deps; a dynamic
// import triggers a mid-run optimize + reload that flakes the axe specs.
import axe from 'axe-core'
import { TimeInput } from '../TimeInput'

async function violations(container: HTMLElement) {
  const results = await axe.run(container, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
  })
  return results.violations.map((v) => `${v.id}: ${v.help}`)
}

type Seg = 'hour' | 'minute' | 'second' | 'dayPeriod'
function seg(container: HTMLElement, type: Seg) {
  return container.querySelector<HTMLElement>(`[data-rx-time-segment="${type}"]`)!
}

describe('semantics', () => {
  it('is a named group of named spinbuttons', async () => {
    // A group, not one control: several separately focusable parts announced as
    // a single field would leave a screen-reader user unable to tell which part
    // they are editing.
    const { container } = await render(<TimeInput label="Start time" locale="en-US" />)
    const group = container.querySelector('[data-rx-time-root]')!
    expect(group).toHaveAttribute('role', 'group')
    expect(group).toHaveAttribute('aria-label', 'Start time')
    expect(page.getByRole('spinbutton').elements()).toHaveLength(3)
    for (const name of ['Hour', 'Minute', 'AM or PM']) {
      await expect.element(page.getByRole('spinbutton', { name })).toBeInTheDocument()
    }
  })

  it('exposes the hour range for the clock in use', async () => {
    const twelve = await render(<TimeInput label="Time" locale="en-US" defaultValue="14:30" />)
    expect(seg(twelve.container, 'hour')).toHaveAttribute('aria-valuemin', '1')
    expect(seg(twelve.container, 'hour')).toHaveAttribute('aria-valuemax', '12')
    // The announced value is the one on the clock face, not the stored 14.
    expect(seg(twelve.container, 'hour')).toHaveAttribute('aria-valuenow', '2')

    const day = await render(<TimeInput label="Time" locale="en-GB" defaultValue="14:30" />)
    expect(seg(day.container, 'hour')).toHaveAttribute('aria-valuemax', '23')
    expect(seg(day.container, 'hour')).toHaveAttribute('aria-valuenow', '14')
  })

  it('announces the day period as a word, not as 0 or 1', async () => {
    const { container } = await render(
      <TimeInput label="Time" locale="en-US" defaultValue="14:30" />,
    )
    expect(seg(container, 'dayPeriod')).toHaveAttribute('aria-valuetext', 'PM')
  })

  it('localises that announcement', async () => {
    const { container } = await render(
      <TimeInput label="Time" locale="ja-JP" hour12 defaultValue="14:30" />,
    )
    expect(seg(container, 'dayPeriod')).toHaveAttribute('aria-valuetext', '午後')
  })

  it('announces the placeholder for an empty segment rather than nothing', async () => {
    const { container } = await render(<TimeInput label="Time" locale="en-GB" />)
    expect(seg(container, 'hour')).toHaveAttribute('aria-valuetext', 'hh')
    // No aria-valuenow while empty — a 0 would be a lie about the value.
    expect(seg(container, 'hour')).not.toHaveAttribute('aria-valuenow')
  })

  it('accepts custom segment labels', async () => {
    await render(
      <TimeInput label="Time" locale="en-GB" segmentLabels={{ hour: 'Heure', minute: 'Minute' }} />,
    )
    await expect.element(page.getByRole('spinbutton', { name: 'Heure' })).toBeInTheDocument()
  })

  it('hides the separators from the accessibility tree', async () => {
    const { container } = await render(<TimeInput label="Time" locale="en-GB" />)
    expect(
      container.querySelectorAll('[data-rx-time-root] > span[aria-hidden="true"]').length,
    ).toBeGreaterThan(0)
  })

  it('marks every segment invalid when the time is out of range', async () => {
    const { container } = await render(
      <TimeInput
        label="Time"
        locale="en-GB"
        min="09:00"
        defaultValue="07:30"
        onWarn={() => undefined}
      />,
    )
    for (const type of ['hour', 'minute'] as const) {
      expect(seg(container, type)).toHaveAttribute('aria-invalid', 'true')
    }
  })

  it('exposes required and read-only states', async () => {
    const { container } = await render(<TimeInput label="Time" locale="en-GB" required readOnly />)
    expect(container.querySelector('[data-rx-time-root]')).toHaveAttribute('aria-required', 'true')
    expect(seg(container, 'hour')).toHaveAttribute('aria-readonly', 'true')
  })

  it('keeps a disabled field in the tree but out of the tab order', async () => {
    const { container } = await render(<TimeInput label="Time" locale="en-GB" disabled />)
    expect(container.querySelector('[data-rx-time-root]')).toHaveAttribute('aria-disabled', 'true')
    expect(seg(container, 'hour')).toHaveAttribute('tabindex', '-1')
    expect(page.getByRole('spinbutton').elements()).toHaveLength(2)
  })

  it('gives every segment its own tab stop, in reading order', async () => {
    const { container } = await render(<TimeInput label="Time" locale="en-US" />)
    seg(container, 'hour').focus()
    await userEvent.tab()
    expect(document.activeElement).toBe(seg(container, 'minute'))
    await userEvent.tab()
    expect(document.activeElement).toBe(seg(container, 'dayPeriod'))
  })

  it('renders a visible focus indicator on the focused segment', async () => {
    // A `<span role="spinbutton">` gets no ring from the browser, and the
    // package suppresses the UA outline to control its own. Without something
    // in its place a keyboard user cannot tell which segment they are on.
    const { container } = await render(<TimeInput label="Time" />)
    await userEvent.tab()

    const focused = container.querySelector<HTMLElement>('[data-rx-time-segment][data-focused]')
    expect(focused).not.toBeNull()
    expect(getComputedStyle(focused!).outlineStyle).not.toBe('none')
  })
})

describe('axe', () => {
  it('is clean while empty', async () => {
    const { container } = await render(<TimeInput label="Time" locale="en-US" name="at" />)
    expect(await violations(container)).toEqual([])
  })

  it('is clean when filled, with seconds', async () => {
    const { container } = await render(
      <TimeInput label="Time" locale="en-US" name="at" showSeconds defaultValue="14:30:05" />,
    )
    expect(await violations(container)).toEqual([])
  })

  it('is clean while invalid and described', async () => {
    const { container } = await render(
      <>
        <TimeInput label="Time" locale="en-GB" invalid aria-describedby="err" />
        <p id="err">Pick a time during opening hours</p>
      </>,
    )
    expect(await violations(container)).toEqual([])
  })

  it('is clean while disabled', async () => {
    const { container } = await render(<TimeInput label="Time" locale="en-GB" disabled />)
    expect(await violations(container)).toEqual([])
  })

  it('is clean in a right-to-left locale', async () => {
    const { container } = await render(
      <div dir="rtl">
        <TimeInput label="الوقت" locale="ar-EG" defaultValue="14:30" />
      </div>,
    )
    expect(await violations(container)).toEqual([])
  })
})
