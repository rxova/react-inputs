import { describe, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { useState } from 'react'
import { SeatMap } from '../SeatMap'
import { parseLayout } from '../layout'
import type { Seat } from '../types'

const ROW = parseLayout('12: ###_###')
const CABIN = parseLayout('10: ##_##\n11: #x_##\n12: ##_##')

function Controlled(props: { initial?: string[] } & Record<string, unknown>) {
  const { initial = [], ...rest } = props
  const [seats, setSeats] = useState<string[]>(initial)
  return <SeatMap sections={ROW} value={seats} onChange={setSeats} label="Seats" {...rest} />
}

describe('rendering', () => {
  it('renders one grid per section, named by the section', async () => {
    await render(<SeatMap sections={parseLayout('Stalls\n1: ##\nCircle\n5: ##')} label="Seats" />)
    expect(page.getByRole('grid').elements()).toHaveLength(2)
    await expect.element(page.getByRole('grid', { name: 'Stalls' })).toBeInTheDocument()
    await expect.element(page.getByRole('grid', { name: 'Circle' })).toBeInTheDocument()
  })

  it('gives every row a header and every column a header', async () => {
    await render(<SeatMap sections={ROW} label="Seats" />)
    await expect.element(page.getByRole('rowheader', { name: '12' })).toBeInTheDocument()
    const headers = page.getByRole('columnheader').elements()
    // One spacer over the row headers, one per cell column including the aisle.
    expect(headers).toHaveLength(8)
    expect(headers.map((element) => element.textContent)).toEqual([
      '',
      'A',
      'B',
      'C',
      '',
      'D',
      'E',
      'F',
    ])
  })

  it('keeps aisles as real cells so the columns cannot drift', async () => {
    const { container } = await render(<SeatMap sections={ROW} label="Seats" />)
    const cells = container.querySelectorAll('[role="row"]:last-of-type > *')
    expect(cells).toHaveLength(8)
    expect(
      container.querySelectorAll('[data-rx-seat-map-row="12"] [data-rx-seat-map-gap]'),
    ).toHaveLength(1)
  })

  it('marks each cell with its state', async () => {
    const { container } = await render(
      <Controlled initial={['12A']} sections={parseLayout('12: ##xo.')} />,
    )
    const states = [...container.querySelectorAll('[data-rx-seat-map-cell]')].map((cell) =>
      cell.getAttribute('data-state'),
    )
    expect(states).toEqual(['selected', 'available', 'occupied', 'held', 'blocked'])
  })

  it('surfaces the seat category as a styling hook', async () => {
    const { container } = await render(
      <SeatMap rows={[{ label: '1', cells: [{ id: '1A', category: 'premium' }] }]} label="Seats" />,
    )
    expect(
      container
        .querySelector('[data-rx-seat-map-category]')
        ?.getAttribute('data-rx-seat-map-category'),
    ).toBe('premium')
  })

  it('distinguishes status by mark as well as colour', async () => {
    // WCAG 1.4.1: a grey fill alone is not a way to say "sold".
    const { container } = await render(
      <Controlled initial={['12A']} sections={parseLayout('12: ##xo.')} />,
    )
    const marks = [...container.querySelectorAll('[data-rx-seat-map-visual]')].map(
      (node) => node.textContent,
    )
    expect(marks).toEqual(['✓', '', '×', '•', '/'])
    expect(new Set(marks).size).toBe(marks.length)
  })

  it('lets a render function replace the visual without touching the name', async () => {
    await render(
      <SeatMap
        sections={ROW}
        onChange={() => undefined}
        label="Seats"
        renderSeat={(state) => <span data-testid="custom">{state.columnLabel}</span>}
      />,
    )
    expect(page.getByTestId('custom').elements()).toHaveLength(6)
    await expect.element(page.getByRole('checkbox', { name: '12A' })).toBeInTheDocument()
  })
})

describe('selection', () => {
  it('picks a seat on click and reports ids and seats', async () => {
    const onChange = vi.fn()
    await render(<SeatMap sections={ROW} onChange={onChange} label="Seats" />)
    await page.getByRole('checkbox', { name: '12B' }).click()
    expect(onChange).toHaveBeenCalledWith(['12B'], [expect.objectContaining({ id: '12B' })])
  })

  it('unpicks on a second click', async () => {
    await render(<Controlled initial={['12B']} />)
    await expect.element(page.getByRole('checkbox', { name: '12B' })).toBeChecked()
    await page.getByRole('checkbox', { name: '12B' }).click()
    await expect.element(page.getByRole('checkbox', { name: '12B' })).not.toBeChecked()
  })

  it('holds several seats at once', async () => {
    await render(<Controlled />)
    await page.getByRole('checkbox', { name: '12A' }).click()
    await page.getByRole('checkbox', { name: '12E' }).click()
    await expect.element(page.getByRole('checkbox', { name: '12A' })).toBeChecked()
    await expect.element(page.getByRole('checkbox', { name: '12E' })).toBeChecked()
  })

  it('starts from defaultValue when uncontrolled', async () => {
    await render(
      <SeatMap sections={ROW} defaultValue={['12C']} onChange={() => undefined} label="Seats" />,
    )
    await expect.element(page.getByRole('checkbox', { name: '12C' })).toBeChecked()
  })

  it('keeps its own state when uncontrolled', async () => {
    await render(<SeatMap sections={ROW} onChange={() => undefined} label="Seats" />)
    await page.getByRole('checkbox', { name: '12A' }).click()
    await expect.element(page.getByRole('checkbox', { name: '12A' })).toBeChecked()
  })

  it('obeys a controlled value that refuses the change', async () => {
    await render(<SeatMap sections={ROW} value={[]} onChange={() => undefined} label="Seats" />)
    await page.getByRole('checkbox', { name: '12A' }).click()
    await expect.element(page.getByRole('checkbox', { name: '12A' })).not.toBeChecked()
  })

  it('drops ids the layout does not know', async () => {
    const onChange = vi.fn()
    await render(
      <SeatMap
        sections={ROW}
        value={['12A', 'nope']}
        onChange={onChange}
        onWarn={() => undefined}
        label="S"
      />,
    )
    await page.getByRole('checkbox', { name: '12B' }).click()
    expect(onChange).toHaveBeenCalledWith(['12A', '12B'], expect.anything())
  })
})

describe('rules', () => {
  it('refuses a sold seat and says why', async () => {
    const onReject = vi.fn()
    await render(
      <SeatMap sections={CABIN} onChange={() => undefined} onReject={onReject} label="Seats" />,
    )
    // `force`, because Playwright treats `aria-disabled` as unclickable — which
    // is exactly the signal the attribute is there to send. A real pointer and a
    // real Space key both reach the seat, and both must explain the refusal.
    await page.getByRole('checkbox', { name: '11B, taken' }).click({ force: true })
    expect(onReject).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'unavailable', message: '11B is already taken.' }),
    )
    await expect.element(page.getByRole('checkbox', { name: '11B, taken' })).not.toBeChecked()
  })

  it('refuses past the cap', async () => {
    const onReject = vi.fn()
    await render(<Controlled maxSeats={1} onReject={onReject} />)
    await page.getByRole('checkbox', { name: '12A' }).click()
    await page.getByRole('checkbox', { name: '12B' }).click()
    expect(onReject).toHaveBeenCalledWith(expect.objectContaining({ reason: 'max-seats' }))
    await expect.element(page.getByRole('checkbox', { name: '12B' })).not.toBeChecked()
  })

  it('refuses a pick that is not next to the others', async () => {
    const onReject = vi.fn()
    await render(<Controlled contiguous onReject={onReject} />)
    await page.getByRole('checkbox', { name: '12A' }).click()
    await page.getByRole('checkbox', { name: '12C' }).click()
    expect(onReject).toHaveBeenCalledWith(expect.objectContaining({ reason: 'not-contiguous' }))
  })

  it('refuses a pick that would strand a seat', async () => {
    const onReject = vi.fn()
    await render(<Controlled sections={parseLayout('12: ###')} noOrphanSeats onReject={onReject} />)
    await page.getByRole('checkbox', { name: '12B' }).click()
    expect(onReject).toHaveBeenCalledWith(expect.objectContaining({ reason: 'orphan-seat' }))
  })

  it('lets isSelectable have the last word', async () => {
    await render(<Controlled isSelectable={(seat: Seat) => seat.id !== '12A'} />)
    await page.getByRole('checkbox', { name: '12A' }).click()
    await expect.element(page.getByRole('checkbox', { name: '12A' })).not.toBeChecked()
    await page.getByRole('checkbox', { name: '12B' }).click()
    await expect.element(page.getByRole('checkbox', { name: '12B' })).toBeChecked()
  })

  it('ignores a nonsensical cap rather than freezing the map', async () => {
    await render(<Controlled maxSeats={0} onWarn={() => undefined} />)
    await page.getByRole('checkbox', { name: '12A' }).click()
    await expect.element(page.getByRole('checkbox', { name: '12A' })).toBeChecked()
  })
})

describe('hover', () => {
  it('reports the hovered seat and clears on leaving the map', async () => {
    const onHoverChange = vi.fn()
    await render(<Controlled onHoverChange={onHoverChange} />)
    await page.getByRole('checkbox', { name: '12B' }).hover()
    expect(onHoverChange).toHaveBeenCalledWith(expect.objectContaining({ id: '12B' }))
    await page.getByRole('heading', { level: 1, includeHidden: true }).elements()
    await userEvent.hover(document.body)
    expect(onHoverChange).toHaveBeenLastCalledWith(null)
  })

  it('stays quiet when the map cannot change', async () => {
    const onHoverChange = vi.fn()
    await render(<SeatMap sections={ROW} label="Seats" onHoverChange={onHoverChange} />)
    await page.getByRole('gridcell', { name: '12B' }).hover()
    expect(onHoverChange).not.toHaveBeenCalled()
  })
})

describe('modes', () => {
  it('is a read-only grid without onChange', async () => {
    await render(<SeatMap sections={ROW} value={['12A']} label="Your seats" />)
    expect(page.getByRole('checkbox').elements()).toHaveLength(0)
    await expect.element(page.getByRole('grid')).toHaveAttribute('aria-readonly', 'true')
    await expect
      .element(page.getByRole('gridcell', { name: '12A' }))
      .toHaveAttribute('aria-selected', 'true')
  })

  it('can be forced read-only while onChange is present', async () => {
    await render(<SeatMap sections={ROW} onChange={() => undefined} readOnly label="Seats" />)
    expect(page.getByRole('checkbox').elements()).toHaveLength(0)
  })

  it('stays a control when disabled, so the field is still announced', async () => {
    const { container } = await render(
      <SeatMap sections={ROW} onChange={() => undefined} disabled label="Seats" />,
    )
    expect(page.getByRole('checkbox', { includeHidden: true }).elements()).toHaveLength(6)
    expect(container.querySelector('[data-disabled]')).not.toBeNull()
  })

  it('does not change while disabled', async () => {
    const onChange = vi.fn()
    await render(<SeatMap sections={ROW} onChange={onChange} disabled label="Seats" />)
    await page.getByRole('checkbox', { name: '12A', includeHidden: true }).click({ force: true })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('mirrors invalid onto ARIA and a data hook', async () => {
    const { container } = await render(
      <SeatMap sections={ROW} onChange={() => undefined} invalid label="Seats" />,
    )
    await expect
      .element(page.getByRole('group', { name: 'Seats' }))
      .toHaveAttribute('aria-invalid', 'true')
    expect(container.querySelector('[data-invalid]')).not.toBeNull()
  })
})

describe('accessible names', () => {
  it('reads position, then why the seat matters, then its status', async () => {
    await render(
      <SeatMap
        rows={[
          {
            label: '12',
            note: 'exit row',
            cells: [{ id: '12A', category: 'premium', features: ['window'], status: 'occupied' }],
          },
        ]}
        onChange={() => undefined}
        label="Seats"
      />,
    )
    await expect
      .element(page.getByRole('checkbox', { name: '12A, premium, exit row, window, taken' }))
      .toBeInTheDocument()
  })

  it('takes a formatter', async () => {
    await render(
      <SeatMap
        sections={ROW}
        onChange={() => undefined}
        label="Seats"
        formatSeatLabel={(seat) => `Seat ${seat.id}`}
      />,
    )
    await expect.element(page.getByRole('checkbox', { name: 'Seat 12A' })).toBeInTheDocument()
  })

  it('prefers an explicit seat label over the composed one', async () => {
    await render(
      <SeatMap
        rows={[{ label: '1', cells: [{ id: 'box-4', label: 'Box 4' }] }]}
        onChange={() => undefined}
        label="Seats"
      />,
    )
    await expect.element(page.getByRole('checkbox', { name: 'Box 4' })).toBeInTheDocument()
  })
})

describe('ref and blur', () => {
  it('exposes the root so focus-first-error can reach it', async () => {
    let node: HTMLDivElement | null = null
    await render(
      <SeatMap
        ref={(element) => {
          node = element
        }}
        sections={ROW}
        label="Seats"
      />,
    )
    expect(node).toBeInstanceOf(HTMLDivElement)
  })

  it('emits blur only when focus leaves the whole map', async () => {
    const onBlur = vi.fn()
    await render(
      <>
        <Controlled onBlur={onBlur} />
        <button type="button">after</button>
      </>,
    )
    await page.getByRole('checkbox', { name: '12A' }).click()
    await userEvent.keyboard('{ArrowRight}')
    expect(onBlur).not.toHaveBeenCalled()
    await page.getByRole('button', { name: 'after' }).click()
    expect(onBlur).toHaveBeenCalledTimes(1)
  })
})
