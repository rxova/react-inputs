import { describe, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { useState } from 'react'
import { SeatMap } from '../SeatMap'
import { parseLayout } from '../layout'
import { findBestSeats } from '../rules'
import type { Seat, SeatMapSection } from '../types'

/**
 * Adversarial suite.
 *
 * Not "does the happy path work" — the other files cover that. Each of these is
 * an attempt to break the component: hostile layouts, hostile props, hostile
 * callbacks, and the invariants the README claims out loud.
 */

const ROW = parseLayout('12: ####')

function Controlled({
  sections = ROW,
  ...rest
}: { sections?: SeatMapSection[] } & Record<string, unknown>) {
  const [seats, setSeats] = useState<string[]>([])
  return <SeatMap sections={sections} value={seats} onChange={setSeats} label="Seats" {...rest} />
}

const seat = (name: string) => page.getByRole('checkbox', { name })
const cells = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('[data-rx-seat-map-cell]'))
const names = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('[data-rx-seat-map-seat]')).map((node) =>
    node.getAttribute('aria-label'),
  )

describe('hostile layouts', () => {
  it('renders an empty grid rather than throwing on nothing at all', async () => {
    const { container } = await render(
      <SeatMap sections={[]} onChange={() => undefined} onWarn={() => undefined} label="Seats" />,
    )
    await expect.element(page.getByRole('group', { name: 'Seats' })).toBeInTheDocument()
    expect(cells(container)).toHaveLength(0)
  })

  it('survives a section with no rows, and a row with no cells', async () => {
    const { container } = await render(
      <SeatMap
        sections={[
          { id: 'a', label: 'A', rows: [] },
          { id: 'b', label: 'B', rows: [{ label: '1', cells: [] }] },
          { id: 'c', label: 'C', rows: [{ label: '1', cells: [null, null] }] },
        ]}
        onChange={() => undefined}
        onWarn={() => undefined}
        label="Seats"
      />,
    )
    expect(page.getByRole('grid').elements()).toHaveLength(3)
    expect(cells(container)).toHaveLength(0)
  })

  it('pads a violently ragged section instead of misaligning the columns', async () => {
    const { container } = await render(
      <Controlled
        sections={[
          {
            id: 's',
            label: 'S',
            rows: [
              {
                label: '1',
                cells: Array.from({ length: 9 }, (_, i) => ({ id: `1-${String(i)}` })),
              },
              { label: '2', cells: [{ id: '2-0' }] },
              { label: '3', cells: [] },
            ],
          },
        ]}
      />,
    )
    const rows = container.querySelectorAll('[data-rx-seat-map-row]')
    const widths = Array.from(rows).map((row) => row.children.length)
    // Header row plus three body rows, every one the same width.
    expect(new Set(widths).size).toBe(1)
  })

  it('escapes markup in a seat label instead of rendering it', async () => {
    const { container } = await render(
      <Controlled
        sections={[
          {
            id: 's',
            label: 'S',
            rows: [{ label: '1', cells: [{ id: 'x', label: '<img src=x onerror=alert(1)>' }] }],
          },
        ]}
      />,
    )
    expect(container.querySelector('img')).toBeNull()
    expect(names(container)).toEqual(['<img src=x onerror=alert(1)>'])
  })

  it('survives seat ids that look like CSS selectors or attribute breakouts', async () => {
    // Navigation looks seats up through a ref map, never `querySelector`, and
    // this is the test that keeps it that way.
    const hostile = ['a"b', "c'd", 'e[f]', 'g h', 'i\\j', '#k', '12A:hover']
    const { container } = await render(
      <Controlled
        sections={[
          { id: 's', label: 'S', rows: [{ label: '1', cells: hostile.map((id) => ({ id })) }] },
        ]}
      />,
    )
    // The ids survive verbatim in the attribute navigation reads back, and the
    // spoken name is still the row-and-column label rather than the raw id.
    const attrs = Array.from(container.querySelectorAll('[data-rx-seat-map-seat]')).map((node) =>
      node.getAttribute('data-rx-seat-map-seat'),
    )
    expect(attrs).toEqual(hostile)
    expect(names(container)).toEqual(['1A', '1B', '1C', '1D', '1E', '1F', '1G'])
  })

  it('navigates a map whose ids contain quotes and brackets', async () => {
    const hostile = ['a"b', "c'd", 'e[f]']
    await render(
      <Controlled
        sections={[
          {
            id: 's',
            label: 'S',
            rows: [{ label: 'R', cells: hostile.map((id, i) => ({ id, label: `S${String(i)}` })) }],
          },
        ]}
      />,
    )
    await seat('S0').click()
    await userEvent.keyboard('{ArrowRight}')
    await expect.element(seat('S1')).toHaveFocus()
    await userEvent.keyboard(' ')
    await expect.element(seat('S1')).toBeChecked()
  })

  it('keeps working when the same id appears twice, and says so once', async () => {
    const onWarn = vi.fn()
    await render(
      <Controlled
        sections={[
          {
            id: 's',
            label: 'S',
            rows: [
              { label: '1', cells: [{ id: 'dup' }, { id: 'dup' }] },
              { label: '2', cells: [{ id: 'dup' }, { id: 'ok' }] },
            ],
          },
        ]}
        onWarn={onWarn}
      />,
    )
    expect(
      onWarn.mock.calls.filter(([w]) => (w as { code: string }).code === 'duplicate-seat-id'),
    ).toHaveLength(1)
    await seat('1ok'.replace('1ok', '2B')).click()
    await expect.element(seat('2B')).toBeChecked()
  })

  it('handles a five thousand seat map in one render', async () => {
    const sections: SeatMapSection[] = [
      {
        id: 'stadium',
        label: 'Stadium',
        rows: Array.from({ length: 100 }, (_, row) => ({
          label: String(row + 1),
          cells: Array.from({ length: 50 }, (_, column) => ({
            id: `${String(row)}-${String(column)}`,
          })),
        })),
      },
    ]
    const started = performance.now()
    const { container } = await render(<Controlled sections={sections} />)
    expect(cells(container)).toHaveLength(5000)
    // Not a benchmark — a guard against an accidental quadratic. The selection
    // membership test is a Set for exactly this reason.
    expect(performance.now() - started).toBeLessThan(15_000)
  })

  it('does not lose focus when the layout changes underneath it', async () => {
    function Swapper() {
      const [wide, setWide] = useState(true)
      const [seats, setSeats] = useState<string[]>([])
      return (
        <>
          <button
            type="button"
            onClick={() => {
              setWide(false)
            }}
          >
            shrink
          </button>
          <SeatMap
            sections={wide ? parseLayout('1: ####') : parseLayout('1: ##')}
            value={seats}
            onChange={setSeats}
            onWarn={() => undefined}
            label="Seats"
          />
        </>
      )
    }
    await render(<Swapper />)
    await seat('1D').click()
    await page.getByRole('button', { name: 'shrink' }).click()
    // 1D is gone. The map must still be usable rather than stuck on a dead ref.
    await seat('1A').click()
    await expect.element(seat('1A')).toBeChecked()
  })
})

describe('hostile props', () => {
  it('ignores a cap that cannot bound anything', async () => {
    for (const maxSeats of [0, -1, 2.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const { unmount } = await render(<Controlled maxSeats={maxSeats} onWarn={() => undefined} />)
      await seat('12A').click()
      await seat('12B').click()
      await expect.element(seat('12B')).toBeChecked()
      await unmount()
    }
  })

  it('never lets a broken pageSize invert or disable the page keys', async () => {
    const tall = parseLayout(
      Array.from({ length: 9 }, (_, index) => `${String(index + 1)}: ##`).join('\n'),
    )
    for (const pageSize of [0, -3, 2.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const { unmount } = await render(<Controlled sections={tall} pageSize={pageSize} />)
      await seat('1A').click()
      await userEvent.keyboard('{PageDown}')
      // Whatever the nonsense, PageDown moves down — the default takes over.
      await expect.element(seat('6A')).toHaveFocus()
      await unmount()
    }
  })

  it('treats a floor above the ceiling as a warning, not a lock-up', async () => {
    const onWarn = vi.fn()
    await render(<Controlled maxSeats={1} minSeats={9} onWarn={onWarn} />)
    await seat('12A').click()
    await expect.element(seat('12A')).toBeChecked()
    expect(onWarn).toHaveBeenCalledWith(expect.objectContaining({ code: 'min-above-max' }))
  })

  it('drops a value made entirely of ids the layout never had', async () => {
    const { container } = await render(
      <SeatMap
        sections={ROW}
        value={['nope', 'also-nope', 'nope']}
        onChange={() => undefined}
        onWarn={() => undefined}
        label="Seats"
      />,
    )
    expect(container.querySelectorAll('[data-state="selected"]')).toHaveLength(0)
  })

  it('accepts a controlled value the rules would have refused', async () => {
    // The rules gate *interaction*. A parent that knows better — restoring a
    // saved booking, say — is not second-guessed, or a reload could not
    // reproduce a selection the venue itself made.
    await render(
      <SeatMap
        sections={parseLayout('12: ####')}
        value={['12A', '12C']}
        onChange={() => undefined}
        contiguous
        label="Seats"
      />,
    )
    await expect.element(seat('12A')).toBeChecked()
    await expect.element(seat('12C')).toBeChecked()
  })
})

describe('hostile callbacks', () => {
  it('refuses the seat when isSelectable throws, rather than crashing', async () => {
    const onReject = vi.fn()
    await render(
      <Controlled
        isSelectable={() => {
          throw new Error('boom')
        }}
        onReject={onReject}
      />,
    )
    await seat('12A').click()
    await expect.element(seat('12A')).not.toBeChecked()
    expect(onReject).toHaveBeenCalledWith(expect.objectContaining({ reason: 'not-selectable' }))
  })

  it('falls back to the built-in name when formatSeatLabel throws', async () => {
    const { container } = await render(
      <Controlled
        formatSeatLabel={() => {
          throw new Error('boom')
        }}
      />,
    )
    expect(names(container)).toEqual(['12A', '12B', '12C', '12D'])
  })

  it('falls back when formatSeatLabel returns something that is not a name', async () => {
    // An unnamed seat is the worst outcome this component has; it must not be
    // reachable by returning undefined or an empty string.
    const { container } = await render(
      <Controlled formatSeatLabel={() => undefined as unknown as string} />,
    )
    expect(names(container)).toEqual(['12A', '12B', '12C', '12D'])
    for (const name of names(container)) expect(name).toMatch(/\S/)
  })

  it('still announces when formatAnnouncement throws', async () => {
    const { container } = await render(
      <Controlled
        formatAnnouncement={() => {
          throw new Error('boom')
        }}
      />,
    )
    await seat('12A').click()
    await expect
      .poll(() => container.querySelector('[data-rx-seat-map-announcement]')?.textContent?.trim())
      .toBe('12A selected. 1 seat chosen.')
  })

  it('still announces when formatAnnouncement returns nothing', async () => {
    const { container } = await render(
      <Controlled formatAnnouncement={() => undefined as unknown as string} />,
    )
    await seat('12A').click()
    await expect
      .poll(() => container.querySelector('[data-rx-seat-map-announcement]')?.textContent?.trim())
      .toMatch(/12A selected/)
  })

  it('falls back to the built-in artwork when renderSeat throws', async () => {
    const { container } = await render(
      <Controlled
        renderSeat={() => {
          throw new Error('boom')
        }}
      />,
    )
    expect(container.querySelectorAll('[data-rx-seat-map-visual]')).toHaveLength(4)
  })

  it('never reports a form valid because formatValidationMessage misbehaved', async () => {
    // An empty custom validity means "valid" to the browser, so a formatter
    // returning nothing must not be able to wave an incomplete booking through.
    for (const formatValidationMessage of [
      () => {
        throw new Error('boom')
      },
      () => '' as string,
      () => undefined as unknown as string,
    ]) {
      const { container, unmount } = await render(
        <Controlled minSeats={2} name="seats" formatValidationMessage={formatValidationMessage} />,
      )
      const first = container.querySelector<HTMLInputElement>('[data-rx-seat-map-seat="12A"]')
      expect(first?.validity.valid).toBe(false)
      expect(first?.validationMessage).toMatch(/\S/)
      await unmount()
    }
  })

  it('keeps its own state when onChange throws', async () => {
    // `onChange` is deliberately NOT contained: it is the consumer's state
    // setter, and swallowing it would desync the parent from the map while
    // hiding the bug. The throw is expected to escape — this only stops the
    // runner reporting the expected escape as an unhandled failure.
    const swallow = (event: ErrorEvent) => {
      event.preventDefault()
      event.stopImmediatePropagation()
    }
    window.addEventListener('error', swallow, true)
    await render(
      <SeatMap
        sections={ROW}
        onChange={() => {
          throw new Error('boom')
        }}
        label="Seats"
      />,
    )
    await seat('12A').click()
    // The uncontrolled value is committed before the callback runs, so a
    // consumer bug cannot desync the map from what it just told them.
    await expect.element(seat('12A')).toBeChecked()
    window.removeEventListener('error', swallow, true)
  })
})

describe('invariants', () => {
  it('never posts a seat that is not visibly chosen', async () => {
    const { container } = await render(<Controlled name="seats" maxSeats={2} />)
    await seat('12A').click()
    await seat('12B').click()
    await seat('12C').click() // refused by the cap
    const posted = Array.from(
      container.querySelectorAll<HTMLInputElement>('input[name="seats"]:checked'),
    ).map((node) => node.value)
    const marked = Array.from(container.querySelectorAll('[data-state="selected"]')).length
    expect(posted).toEqual(['12A', '12B'])
    expect(marked).toBe(posted.length)
  })

  it('lets a rule-broken selection be undone, always', async () => {
    // `contiguous` refuses picks, never releases. Deselecting out of the middle
    // of a block is allowed on purpose: a rule that traps someone in a booking
    // they cannot undo is worse than any it prevents.
    await render(<Controlled contiguous />)
    await seat('12A').click()
    await seat('12B').click()
    await seat('12C').click()
    await seat('12B').click()
    await expect.element(seat('12B')).not.toBeChecked()
    await expect.element(seat('12A')).toBeChecked()
    await expect.element(seat('12C')).toBeChecked()
  })

  it('keeps exactly one tab stop per grid through every interaction', async () => {
    const { container } = await render(
      <Controlled sections={parseLayout('Stalls\n1: ##_##\nCircle\n5: ###')} />,
    )
    const check = () => {
      for (const grid of container.querySelectorAll('[role="grid"]')) {
        expect(grid.querySelectorAll('[data-rx-seat-map-seat][tabindex="0"]')).toHaveLength(1)
      }
    }
    check()
    await seat('1B').click()
    check()
    await userEvent.keyboard('{ArrowRight}{ArrowRight}')
    check()
    await seat('1B').click()
    check()
  })

  it('does not leak state between two maps on one page', async () => {
    await render(
      <>
        <Controlled />
        <Controlled sections={parseLayout('20: ###')} />
      </>,
    )
    await seat('12A').click()
    await expect.element(seat('12A')).toBeChecked()
    await expect.element(seat('20A')).not.toBeChecked()
    await seat('20A').click()
    await expect.element(seat('12A')).toBeChecked()
    await expect.element(seat('20A')).toBeChecked()
  })

  it('cannot be arrowed out of the grid into nothing', async () => {
    await render(<Controlled />)
    await seat('12A').click()
    for (const key of [
      '{ArrowLeft}',
      '{ArrowUp}',
      '{Home}',
      '{PageUp}',
      '{Control>}{Home}{/Control}',
    ]) {
      await userEvent.keyboard(key)
      expect(document.activeElement?.getAttribute('data-rx-seat-map-seat')).toBe('12A')
    }
  })

  it('survives Shift+Arrow at the end of a row', async () => {
    await render(<Controlled />)
    await seat('12D').click()
    await userEvent.keyboard('{Shift>}{ArrowRight}{/Shift}')
    await expect.element(seat('12D')).toHaveFocus()
    await expect.element(seat('12D')).toBeChecked()
  })

  it('ignores keys aimed at the grid itself rather than a seat', async () => {
    const { container } = await render(<Controlled />)
    const grid = container.querySelector<HTMLElement>('[role="grid"]')
    grid?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    grid?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    expect(container.querySelectorAll('[data-state="selected"]')).toHaveLength(0)
  })

  it('holds up under a hundred toggles of one seat', async () => {
    const { container } = await render(<Controlled />)
    const input = container.querySelector<HTMLInputElement>('[data-rx-seat-map-seat="12A"]')
    for (let i = 0; i < 100; i++) input?.click()
    expect(input?.checked).toBe(false)
    expect(container.querySelectorAll('[data-state="selected"]')).toHaveLength(0)
  })
})

describe('findBestSeats under abuse', () => {
  it('refuses counts that are not a positive integer', () => {
    for (const count of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(findBestSeats(ROW, count)).toEqual([])
    }
  })

  it('refuses a count no row could hold', () => {
    expect(findBestSeats(ROW, Number.MAX_SAFE_INTEGER)).toEqual([])
    expect(findBestSeats(ROW, 99)).toEqual([])
  })

  it('treats a throwing isSelectable as a refusal, not a crash', () => {
    expect(
      findBestSeats(ROW, 2, {
        isSelectable: () => {
          throw new Error('boom')
        },
      }),
    ).toEqual([])
  })

  it('never proposes a seat that is not available', () => {
    const map = parseLayout('1: #x#o#.#')
    const found: Seat[] = findBestSeats(map, 1)
    expect(found.every((s) => (s.status ?? 'available') === 'available')).toBe(true)
  })
})
