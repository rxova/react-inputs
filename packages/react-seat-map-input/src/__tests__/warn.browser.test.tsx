import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { page } from 'vitest/browser'
import { SeatMap } from '../SeatMap'
import { parseLayout } from '../layout'

/**
 * The warnings themselves are unit-tested against `warn.ts`; this file is about
 * the wiring — that they reach `onWarn`, fall back to the console, and fire
 * once per instance however many times a controlled map re-renders.
 */

const ROW = parseLayout('12: ##')

describe('onWarn', () => {
  it('reports an id the layout does not know', async () => {
    const onWarn = vi.fn()
    await render(<SeatMap sections={ROW} value={['nope']} onWarn={onWarn} label="Seats" />)
    expect(onWarn).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'unknown-seat-id', seatId: 'nope' }),
    )
  })

  it('reports a duplicate seat id', async () => {
    const onWarn = vi.fn()
    await render(
      <SeatMap
        rows={[
          { label: '1', cells: [{ id: 'dup' }] },
          { label: '2', cells: [{ id: 'dup' }] },
        ]}
        onWarn={onWarn}
        label="Seats"
      />,
    )
    expect(onWarn).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'duplicate-seat-id', seatId: 'dup' }),
    )
  })

  it('reports an empty map', async () => {
    const onWarn = vi.fn()
    await render(<SeatMap sections={[]} onWarn={onWarn} label="Seats" />)
    expect(onWarn).toHaveBeenCalledWith(expect.objectContaining({ code: 'no-layout' }))
  })

  it('reports a nonsensical cap and a floor above it', async () => {
    const onWarn = vi.fn()
    await render(<SeatMap sections={ROW} maxSeats={0} onWarn={onWarn} label="Seats" />)
    expect(onWarn).toHaveBeenCalledWith(expect.objectContaining({ code: 'max-seats-invalid' }))

    const second = vi.fn()
    await render(<SeatMap sections={ROW} maxSeats={1} minSeats={3} onWarn={second} label="Seats" />)
    expect(second).toHaveBeenCalledWith(expect.objectContaining({ code: 'min-above-max' }))
  })

  it('warns once per instance, not once per render', async () => {
    const onWarn = vi.fn()
    const { rerender } = await render(
      <SeatMap sections={ROW} value={['nope']} onWarn={onWarn} label="Seats" />,
    )
    await rerender(<SeatMap sections={ROW} value={['nope']} onWarn={onWarn} label="Seats" />)
    await rerender(<SeatMap sections={ROW} value={['nope']} onWarn={onWarn} label="Seats" />)
    expect(onWarn).toHaveBeenCalledTimes(1)
  })

  it('falls back to the console when no handler is given', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    await render(<SeatMap sections={ROW} value={['nope']} label="Seats" />)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[react-seat-map-input]'))
    warn.mockRestore()
  })

  it('keeps rendering a usable map despite every warning at once', async () => {
    await render(
      <SeatMap
        rows={[
          { label: '1', cells: [{ id: 'dup' }, { id: 'dup' }] },
          { label: '2', cells: [{ id: 'ok' }, null] },
        ]}
        value={['nope']}
        maxSeats={0}
        minSeats={9}
        onChange={() => undefined}
        onWarn={() => undefined}
        label="Seats"
      />,
    )
    await expect.element(page.getByRole('grid', { name: 'Seats' })).toBeInTheDocument()
    expect(page.getByRole('checkbox').elements()).toHaveLength(3)
  })
})
