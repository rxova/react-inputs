import { describe, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { useState } from 'react'
import { SeatMap } from '../SeatMap'
import { parseLayout } from '../layout'
import type { SyntheticEvent } from 'react'
import type { SeatMapSection } from '../types'

/**
 * Two-dimensional navigation is the one thing this component implements that no
 * native element provides, so it is the one thing most worth pinning. Every
 * assertion here is about real focus in a real browser: jsdom's focus model
 * would let a broken roving tabindex pass.
 */

const CABIN = parseLayout(`
  10: ##_##
  11: #x_##
  12: ##_##
`)

const TALL = parseLayout(
  Array.from({ length: 9 }, (_, index) => `${String(index + 1)}: ##`).join('\n'),
)

function Controlled({
  sections = CABIN,
  ...rest
}: { sections?: SeatMapSection[] } & Record<string, unknown>) {
  const [seats, setSeats] = useState<string[]>([])
  return <SeatMap sections={sections} value={seats} onChange={setSeats} label="Seats" {...rest} />
}

const seat = (name: string) => page.getByRole('checkbox', { name })

describe('entering the map', () => {
  it('costs exactly one tab stop per section', async () => {
    await render(
      <>
        <button type="button">before</button>
        <Controlled sections={parseLayout('Stalls\n1: ##\nCircle\n5: ##')} />
        <button type="button">after</button>
      </>,
    )
    await page.getByRole('button', { name: 'before' }).click()
    await userEvent.tab()
    await expect.element(seat('1A')).toHaveFocus()
    await userEvent.tab()
    await expect.element(seat('5A')).toHaveFocus()
    await userEvent.tab()
    await expect.element(page.getByRole('button', { name: 'after' })).toHaveFocus()
  })

  it('lands on the first seat that can still be chosen', async () => {
    await render(<Controlled sections={parseLayout('1: xx##')} />)
    await userEvent.tab()
    await expect.element(seat('1C')).toHaveFocus()
  })

  it('prefers a seat already chosen, so tabbing back resumes where you were', async () => {
    await render(<SeatMap sections={CABIN} value={['12D']} onChange={() => undefined} label="S" />)
    await userEvent.tab()
    await expect.element(seat('12D')).toHaveFocus()
  })

  it('falls back to the first seat in a sold-out block', async () => {
    await render(<Controlled sections={parseLayout('1: xx')} />)
    await userEvent.tab()
    await expect.element(seat('1A, taken')).toHaveFocus()
  })
})

describe('arrow keys', () => {
  it('steps over the aisle rather than into it', async () => {
    await render(<Controlled />)
    await seat('10B').click()
    await userEvent.keyboard('{ArrowRight}')
    await expect.element(seat('10C')).toHaveFocus()
    await userEvent.keyboard('{ArrowLeft}')
    await expect.element(seat('10B')).toHaveFocus()
  })

  it('stays in the same column going up and down', async () => {
    await render(<Controlled />)
    await seat('10D').click()
    await userEvent.keyboard('{ArrowDown}')
    await expect.element(seat('11D')).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    await expect.element(seat('12D')).toHaveFocus()
  })

  it('reaches sold seats, so a keyboard user can learn which ones are gone', async () => {
    // Every competitor renders these as inert or `disabled`, which makes the
    // occupied half of a cabin invisible to anyone not using a mouse.
    await render(<Controlled />)
    await seat('10B').click()
    await userEvent.keyboard('{ArrowDown}')
    await expect.element(seat('11B, taken')).toHaveFocus()
  })

  it('stops at the edges instead of wrapping across the cabin', async () => {
    await render(<Controlled />)
    await seat('10A').click()
    await userEvent.keyboard('{ArrowLeft}')
    await expect.element(seat('10A')).toHaveFocus()
    await userEvent.keyboard('{ArrowUp}')
    await expect.element(seat('10A')).toHaveFocus()
  })

  it('skips a row that has no seat in this column', async () => {
    await render(<Controlled sections={parseLayout('1: ##\n2: #_\n3: ##')} />)
    await seat('1B').click()
    await userEvent.keyboard('{ArrowDown}')
    await expect.element(seat('3B')).toHaveFocus()
  })

  it('leaves Alt-modified arrows to the browser', async () => {
    await render(<Controlled />)
    await seat('10B').click()
    await userEvent.keyboard('{Alt>}{ArrowRight}{/Alt}')
    await expect.element(seat('10B')).toHaveFocus()
  })
})

describe('jumps', () => {
  it('Home and End reach the ends of the row', async () => {
    await render(<Controlled />)
    await seat('10C').click()
    await userEvent.keyboard('{End}')
    await expect.element(seat('10D')).toHaveFocus()
    await userEvent.keyboard('{Home}')
    await expect.element(seat('10A')).toHaveFocus()
  })

  it('Ctrl+Home and Ctrl+End reach the ends of the section', async () => {
    await render(<Controlled />)
    await seat('11C').click()
    await userEvent.keyboard('{Control>}{End}{/Control}')
    await expect.element(seat('12D')).toHaveFocus()
    await userEvent.keyboard('{Control>}{Home}{/Control}')
    await expect.element(seat('10A')).toHaveFocus()
  })

  it('PageDown and PageUp move five rows by default', async () => {
    await render(<Controlled sections={TALL} />)
    await seat('1A').click()
    await userEvent.keyboard('{PageDown}')
    await expect.element(seat('6A')).toHaveFocus()
    await userEvent.keyboard('{PageUp}')
    await expect.element(seat('1A')).toHaveFocus()
  })

  it('takes a custom page size', async () => {
    await render(<Controlled sections={TALL} pageSize={2} />)
    await seat('1A').click()
    await userEvent.keyboard('{PageDown}')
    await expect.element(seat('3A')).toHaveFocus()
  })

  it('clamps a page jump to the last row', async () => {
    await render(<Controlled sections={TALL} />)
    await seat('7A').click()
    await userEvent.keyboard('{PageDown}')
    await expect.element(seat('9A')).toHaveFocus()
  })
})

describe('choosing', () => {
  it('toggles with Space, which is the checkbox doing its own job', async () => {
    await render(<Controlled />)
    await userEvent.tab()
    await userEvent.keyboard(' ')
    await expect.element(seat('10A')).toBeChecked()
    await userEvent.keyboard(' ')
    await expect.element(seat('10A')).not.toBeChecked()
  })

  it('also toggles with Enter, which a checkbox does not', async () => {
    await render(<Controlled />)
    await userEvent.tab()
    await userEvent.keyboard('{Enter}')
    await expect.element(seat('10A')).toBeChecked()
  })

  it('does not submit the surrounding form when Enter chooses a seat', async () => {
    const onSubmit = vi.fn((event: SyntheticEvent) => {
      event.preventDefault()
    })
    await render(
      <form onSubmit={onSubmit}>
        <Controlled />
      </form>,
    )
    await userEvent.tab()
    await userEvent.keyboard('{Enter}')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('extends a block with Shift and an arrow', async () => {
    await render(<Controlled />)
    await seat('10A').click()
    await userEvent.keyboard('{Shift>}{ArrowRight}{/Shift}')
    await expect.element(seat('10B')).toBeChecked()
    await expect.element(seat('10A')).toBeChecked()
  })

  it('never unpicks with Shift, so a slip cannot cost a booking', async () => {
    await render(<Controlled />)
    await seat('10A').click()
    await seat('10B').click()
    await seat('10A').click()
    await userEvent.keyboard('{Shift>}{ArrowRight}{/Shift}')
    await expect.element(seat('10B')).toBeChecked()
  })
})

describe('read-only navigation', () => {
  it('is a navigable grid, because a diagram is still information', async () => {
    await render(<SeatMap sections={CABIN} value={['10A']} label="Your seats" />)
    await userEvent.tab()
    await expect.element(page.getByRole('gridcell', { name: '10A' })).toHaveFocus()
    await userEvent.keyboard('{ArrowRight}')
    await expect.element(page.getByRole('gridcell', { name: '10B' })).toHaveFocus()
  })

  it('changes nothing on Space or Enter', async () => {
    await render(<SeatMap sections={CABIN} value={[]} label="Your seats" />)
    await userEvent.tab()
    await userEvent.keyboard('{Enter} ')
    await expect
      .element(page.getByRole('gridcell', { name: '10A' }))
      .toHaveAttribute('aria-selected', 'false')
  })
})

describe('right to left', () => {
  it('follows the visual direction, not the DOM order', async () => {
    await render(<Controlled dir="rtl" />)
    await seat('10B').click()
    // In RTL, `10C` is drawn to the *left* of `10B`.
    await userEvent.keyboard('{ArrowLeft}')
    await expect.element(seat('10C')).toHaveFocus()
    await userEvent.keyboard('{ArrowRight}')
    await expect.element(seat('10B')).toHaveFocus()
  })
})

describe('scrolling', () => {
  it('brings the focused seat into view inside a scroll container', async () => {
    const { container } = await render(
      <div style={{ maxHeight: 90, overflow: 'auto' }} data-testid="scroller">
        <Controlled sections={TALL} />
      </div>,
    )
    const scroller = container.querySelector<HTMLElement>('[data-testid="scroller"]')
    await seat('1A').click()
    expect(scroller?.scrollTop).toBe(0)

    await userEvent.keyboard('{PageDown}')
    await expect.element(seat('6A')).toHaveFocus()
    // Real geometry, not a style string: this is exactly the assertion jsdom
    // cannot make.
    expect(scroller?.scrollTop).toBeGreaterThan(0)
  })
})
