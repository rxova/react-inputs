import { describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { useState } from 'react'
import { SeatMap } from '../SeatMap'
import { parseLayout } from '../layout'

/**
 * The reason this package exists. Every seat picker on npm either has no
 * keyboard story at all or hides its accessibility behind a config flag that is
 * off by default, and all of them render sold seats as something a keyboard
 * cannot reach. These assertions are the claim, so they are executable.
 */

const CABIN = parseLayout(`
  10: ##_##
  11: #x_o#
  12: ##_##
`)

async function violations(container: HTMLElement) {
  const axe = (await import('axe-core')).default
  const results = await axe.run(container, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
  })
  return results.violations.map((violation) => `${violation.id}: ${violation.help}`)
}

function Controlled({ initial = [], ...rest }: { initial?: string[] } & Record<string, unknown>) {
  const [seats, setSeats] = useState<string[]>(initial)
  return <SeatMap sections={CABIN} value={seats} onChange={setSeats} label="Seats" {...rest} />
}

describe('axe', () => {
  it('is clean when empty', async () => {
    const { container } = await render(<Controlled />)
    expect(await violations(container)).toEqual([])
  })

  it('is clean with a selection', async () => {
    const { container } = await render(<Controlled initial={['10A', '10B']} />)
    expect(await violations(container)).toEqual([])
  })

  it('is clean in a sold-out block', async () => {
    const { container } = await render(<Controlled sections={parseLayout('1: xxx')} />)
    expect(await violations(container)).toEqual([])
  })

  it('is clean read-only', async () => {
    const { container } = await render(<SeatMap sections={CABIN} value={['10A']} label="Yours" />)
    expect(await violations(container)).toEqual([])
  })

  it('is clean disabled', async () => {
    const { container } = await render(<Controlled disabled />)
    expect(await violations(container)).toEqual([])
  })

  it('is clean in an invalid, described state', async () => {
    const { container } = await render(
      <>
        <Controlled invalid aria-describedby="seat-error" />
        <p id="seat-error">Choose at least one seat.</p>
      </>,
    )
    expect(await violations(container)).toEqual([])
  })

  it('is clean in RTL', async () => {
    const { container } = await render(<Controlled dir="rtl" initial={['12D']} />)
    expect(await violations(container)).toEqual([])
  })

  it('is clean across several sections', async () => {
    const { container } = await render(
      <Controlled sections={parseLayout('Stalls\n1: ##_##\nCircle\n5: ###')} />,
    )
    expect(await violations(container)).toEqual([])
  })
})

describe('grid semantics', () => {
  it('is a group of grids, each named', async () => {
    await render(<Controlled sections={parseLayout('Stalls\n1: ##\nCircle\n5: ##')} />)
    await expect.element(page.getByRole('group', { name: 'Seats' })).toBeInTheDocument()
    expect(
      page
        .getByRole('grid')
        .elements()
        .map((node) => node.getAttribute('aria-label')),
    ).toEqual(['Stalls', 'Circle'])
  })

  it('states selection with the checkbox and nothing else', async () => {
    // Two selection models on one control is double-speak: a screen reader
    // would announce "selected, checked".
    const { container } = await render(<Controlled initial={['10A']} />)
    expect(container.querySelector('[aria-selected]')).toBeNull()
    await expect.element(page.getByRole('checkbox', { name: '10A' })).toBeChecked()
  })

  it('states selection with aria-selected when there is no checkbox to carry it', async () => {
    await render(<SeatMap sections={CABIN} value={['10A']} label="Yours" />)
    await expect
      .element(page.getByRole('gridcell', { name: '10A' }))
      .toHaveAttribute('aria-selected', 'true')
    await expect.element(page.getByRole('grid')).toHaveAttribute('aria-multiselectable', 'true')
  })

  it('hides the decorative seat visual from the accessibility tree', async () => {
    const { container } = await render(<Controlled />)
    const visuals = container.querySelectorAll('[data-rx-seat-map-visual]')
    expect(visuals.length).toBeGreaterThan(0)
    for (const visual of visuals) expect(visual).toHaveAttribute('aria-hidden', 'true')
  })

  it('gives every seat a distinct accessible name', async () => {
    await render(<Controlled />)
    const names = page
      .getByRole('checkbox')
      .elements()
      .map((node) => node.getAttribute('aria-label'))
    expect(names).toHaveLength(12)
    expect(new Set(names).size).toBe(names.length)
    for (const name of names) expect(name).toMatch(/\S/)
  })

  it('wires describedby, invalid and disabled onto the field', async () => {
    await render(<Controlled invalid disabled aria-describedby="hint" />)
    const group = page.getByRole('group', { name: 'Seats' })
    await expect.element(group).toHaveAttribute('aria-describedby', 'hint')
    await expect.element(group).toHaveAttribute('aria-invalid', 'true')
    await expect.element(group).toHaveAttribute('aria-disabled', 'true')
  })
})

describe('unavailable seats', () => {
  it('says the status in the name rather than only in the colour', async () => {
    await render(<Controlled />)
    await expect.element(page.getByRole('checkbox', { name: '11B, taken' })).toBeInTheDocument()
    await expect.element(page.getByRole('checkbox', { name: '11C, on hold' })).toBeInTheDocument()
  })

  it('uses aria-disabled, never the attribute that removes them from the tab order', async () => {
    const { container } = await render(<Controlled />)
    const sold = container.querySelector('[data-rx-seat-map-seat="11B"]')
    expect(sold).toHaveAttribute('aria-disabled', 'true')
    expect(sold).not.toHaveAttribute('disabled')
  })

  it('is reachable by keyboard', async () => {
    await render(<Controlled />)
    await page.getByRole('checkbox', { name: '10B' }).click()
    await userEvent.keyboard('{ArrowDown}')
    await expect.element(page.getByRole('checkbox', { name: '11B, taken' })).toHaveFocus()
  })
})

describe('roving tabindex', () => {
  it('leaves exactly one tabbable seat per section', async () => {
    const { container } = await render(
      <Controlled sections={parseLayout('Stalls\n1: ##_##\nCircle\n5: ###')} />,
    )
    const grids = container.querySelectorAll('[role="grid"]')
    expect(grids).toHaveLength(2)
    for (const grid of grids) {
      expect(grid.querySelectorAll('[data-rx-seat-map-seat][tabindex="0"]')).toHaveLength(1)
    }
  })

  it('moves the tab stop to wherever focus went', async () => {
    const { container } = await render(<Controlled />)
    await page.getByRole('checkbox', { name: '12D' }).click()
    const tabbable = container.querySelector('[data-rx-seat-map-seat][tabindex="0"]')
    expect(tabbable?.getAttribute('data-rx-seat-map-seat')).toBe('12D')
  })

  it('takes the whole field out of the tab order when disabled', async () => {
    await render(
      <>
        <button type="button">before</button>
        <Controlled disabled />
        <button type="button">after</button>
      </>,
    )
    await page.getByRole('button', { name: 'before' }).click()
    await userEvent.tab()
    await expect.element(page.getByRole('button', { name: 'after' })).toHaveFocus()
  })
})

describe('focus indicator', () => {
  it('draws a ring on the focused cell for keyboard focus', async () => {
    const { container } = await render(<Controlled />)
    await userEvent.tab()
    const cell = container.querySelector<HTMLElement>('[data-focused]')
    expect(cell).not.toBeNull()
    expect(cell && getComputedStyle(cell).outlineStyle).not.toBe('none')
  })

  it('offsets the ring outward so a scroll container cannot clip it', async () => {
    const { container } = await render(<Controlled />)
    await userEvent.tab()
    const cell = container.querySelector<HTMLElement>('[data-focused]')
    expect(cell && parseFloat(getComputedStyle(cell).outlineOffset)).toBeGreaterThan(0)
  })

  it('does not paint a ring for a pointer click', async () => {
    const { container } = await render(<Controlled />)
    await page.getByRole('checkbox', { name: '10A' }).click()
    // `:focus-visible` is the browser's own judgement of whether a ring helps.
    expect(container.querySelector('[data-focused]')).toBeNull()
  })
})

describe('target size', () => {
  it('clears the 24×24 floor at the default seat size', async () => {
    // WCAG 2.2 §2.5.8. A component that only passes at a custom size is a
    // component that ships failing.
    const { container } = await render(<Controlled />)
    const cell = container.querySelector('[data-rx-seat-map-cell]')
    const rect = cell?.getBoundingClientRect()
    expect(rect?.width).toBeGreaterThanOrEqual(24)
    expect(rect?.height).toBeGreaterThanOrEqual(24)
  })

  it('covers the whole cell with the control, not just its centre', async () => {
    const { container } = await render(<Controlled />)
    const cell = container.querySelector('[data-rx-seat-map-cell]')?.getBoundingClientRect()
    const input = container.querySelector('[data-rx-seat-map-seat="10A"]')?.getBoundingClientRect()
    expect(input?.width).toBe(cell?.width)
    expect(input?.height).toBe(cell?.height)
  })
})

describe('live region', () => {
  it('is polite, atomic, and off screen but still in the tree', async () => {
    const { container } = await render(<Controlled />)
    const region = container.querySelector<HTMLElement>('[data-rx-seat-map-announcement]')
    expect(region).toHaveAttribute('aria-live', 'polite')
    expect(region).toHaveAttribute('aria-atomic', 'true')
    const style = region && getComputedStyle(region)
    expect(style?.display).not.toBe('none')
    expect(style?.visibility).not.toBe('hidden')
    expect(region?.getBoundingClientRect().width).toBeLessThanOrEqual(1)
  })
})
