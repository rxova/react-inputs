import { describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
// Static import so Vite pre-bundles axe-core with the other deps; a dynamic
// import triggers a mid-run optimize + reload that flakes the axe specs.
import axe from 'axe-core'
import { DateInput } from '../DateInput'

async function violations(container: HTMLElement) {
  const results = await axe.run(container, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
  })
  return results.violations.map((v) => `${v.id}: ${v.help}`)
}

function segment(container: HTMLElement, type: 'day' | 'month' | 'year') {
  return container.querySelector<HTMLElement>(`[data-rx-date-segment="${type}"]`)!
}

describe('semantics', () => {
  it('is a named group of named spinbuttons', async () => {
    // A group, not one control: three separately focusable parts announced as a
    // single field would leave a screen-reader user unable to tell which part
    // they are editing.
    const { container } = await render(<DateInput label="Date of birth" locale="en-GB" />)
    const group = container.querySelector('[data-rx-date-root]')!
    expect(group).toHaveAttribute('role', 'group')
    expect(group).toHaveAttribute('aria-label', 'Date of birth')
    expect(page.getByRole('spinbutton').elements()).toHaveLength(3)
    for (const name of ['Day', 'Month', 'Year']) {
      await expect.element(page.getByRole('spinbutton', { name })).toBeInTheDocument()
    }
  })

  it('accepts custom segment labels', async () => {
    await render(
      <DateInput
        label="Date"
        locale="en-GB"
        segmentLabels={{ day: 'Jour', month: 'Mois', year: 'Année' }}
      />,
    )
    await expect.element(page.getByRole('spinbutton', { name: 'Jour' })).toBeInTheDocument()
  })

  it('exposes the range and the value of each segment', async () => {
    const { container } = await render(
      <DateInput label="Date" locale="en-GB" defaultValue="2024-02-15" />,
    )
    const day = segment(container, 'day')
    expect(day).toHaveAttribute('aria-valuenow', '15')
    expect(day).toHaveAttribute('aria-valuemin', '1')
    // February 2024 is a leap year, so the day range really is 1–29.
    expect(day).toHaveAttribute('aria-valuemax', '29')
  })

  it('announces the month by name, not by number', async () => {
    // "3" is the value; "March" is the thing the user is actually choosing.
    const { container } = await render(
      <DateInput label="Date" locale="en-GB" defaultValue="2026-03-15" />,
    )
    expect(segment(container, 'month')).toHaveAttribute('aria-valuetext', 'March')
  })

  it('localises that announcement', async () => {
    const { container } = await render(
      <DateInput label="Date" locale="fr-FR" defaultValue="2026-03-15" />,
    )
    expect(segment(container, 'month').getAttribute('aria-valuetext')?.toLowerCase()).toBe('mars')
  })

  it('announces the placeholder for an empty segment rather than nothing', async () => {
    const { container } = await render(<DateInput label="Date" locale="en-GB" />)
    expect(segment(container, 'day')).toHaveAttribute('aria-valuetext', 'dd')
    // No aria-valuenow at all while empty — a 0 would be a lie about the value.
    expect(segment(container, 'day')).not.toHaveAttribute('aria-valuenow')
  })

  it('hides the separators from the accessibility tree', async () => {
    const { container } = await render(<DateInput label="Date" locale="en-GB" />)
    const literals = container.querySelectorAll('[data-rx-date-root] > span[aria-hidden="true"]')
    expect(literals.length).toBeGreaterThan(0)
  })

  it('marks the whole field invalid when the date falls outside the range', async () => {
    const { container } = await render(
      <DateInput
        label="Date"
        locale="en-GB"
        min="2026-01-01"
        defaultValue="1999-03-15"
        onWarn={() => undefined}
      />,
    )
    for (const type of ['day', 'month', 'year'] as const) {
      expect(segment(container, type)).toHaveAttribute('aria-invalid', 'true')
    }
  })

  it('exposes required and read-only states', async () => {
    const { container } = await render(<DateInput label="Date" locale="en-GB" required readOnly />)
    expect(container.querySelector('[data-rx-date-root]')).toHaveAttribute('aria-required', 'true')
    expect(segment(container, 'day')).toHaveAttribute('aria-readonly', 'true')
  })

  it('keeps a disabled field in the tree but out of the tab order', async () => {
    const { container } = await render(<DateInput label="Date" locale="en-GB" disabled />)
    expect(container.querySelector('[data-rx-date-root]')).toHaveAttribute('aria-disabled', 'true')
    expect(segment(container, 'day')).toHaveAttribute('tabindex', '-1')
    // Still announced, so the field does not silently vanish for a screen
    // reader user working through the form.
    expect(page.getByRole('spinbutton').elements()).toHaveLength(3)
  })

  it('gives every segment its own tab stop, in reading order', async () => {
    const { container } = await render(<DateInput label="Date" locale="en-GB" />)
    segment(container, 'day').focus()
    await userEvent.tab()
    expect(document.activeElement).toBe(segment(container, 'month'))
    await userEvent.tab()
    expect(document.activeElement).toBe(segment(container, 'year'))
  })

  it('renders a visible focus indicator on the focused segment', async () => {
    // A `<span role="spinbutton">` gets no ring from the browser, and the
    // package suppresses the UA outline to control its own. Without something
    // in its place a keyboard user cannot tell which of three segments they are
    // on — WCAG 2.4.7 with no mitigation, and invisible to every other test.
    const { container } = await render(<DateInput label="Date" />)
    await userEvent.tab()

    const focused = container.querySelector<HTMLElement>('[data-rx-date-segment][data-focused]')
    expect(focused).not.toBeNull()
    expect(getComputedStyle(focused!).outlineStyle).not.toBe('none')
  })
})

describe('axe', () => {
  it('is clean while empty', async () => {
    const { container } = await render(<DateInput label="Date" locale="en-GB" name="date" />)
    expect(await violations(container)).toEqual([])
  })

  it('is clean when filled', async () => {
    const { container } = await render(
      <DateInput label="Date" locale="en-GB" name="date" defaultValue="2026-03-15" />,
    )
    expect(await violations(container)).toEqual([])
  })

  it('is clean while invalid and described', async () => {
    const { container } = await render(
      <>
        <DateInput label="Date" locale="en-GB" invalid aria-describedby="err" />
        <p id="err">Pick a date in the future</p>
      </>,
    )
    expect(await violations(container)).toEqual([])
  })

  it('is clean while disabled', async () => {
    const { container } = await render(<DateInput label="Date" locale="en-GB" disabled />)
    expect(await violations(container)).toEqual([])
  })

  it('is clean in a right-to-left locale', async () => {
    const { container } = await render(
      <div dir="rtl">
        <DateInput label="التاريخ" locale="ar-EG" defaultValue="2026-03-15" />
      </div>,
    )
    expect(await violations(container)).toEqual([])
  })
})
