import { describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { useState } from 'react'
import { SeatMap } from '../SeatMap'
import { parseLayout } from '../layout'
import type { SeatMapAnnouncement } from '../types'

/**
 * A seat that simply refuses to tick, with no spoken reason, is
 * indistinguishable from a broken control. Every refusal this component can
 * produce has to reach the live region, which is the part no competitor ships.
 */

const ROW = parseLayout('12: #x##')

function Controlled(props: Record<string, unknown>) {
  const [seats, setSeats] = useState<string[]>([])
  return <SeatMap sections={ROW} value={seats} onChange={setSeats} label="Seats" {...props} />
}

const region = (container: HTMLElement) =>
  container.querySelector('[data-rx-seat-map-announcement]')?.textContent?.trim() ?? ''

describe('announcements', () => {
  it('says nothing before anything has happened', async () => {
    const { container } = await render(<Controlled />)
    expect(region(container)).toBe('')
  })

  it('names the seat and the running count on a pick', async () => {
    const { container } = await render(<Controlled />)
    await page.getByRole('checkbox', { name: '12A' }).click()
    await expect.poll(() => region(container)).toBe('12A selected. 1 seat chosen.')
  })

  it('pluralises the count', async () => {
    const { container } = await render(<Controlled />)
    await page.getByRole('checkbox', { name: '12A' }).click()
    await page.getByRole('checkbox', { name: '12C' }).click()
    await expect.poll(() => region(container)).toBe('12C selected. 2 seats chosen.')
  })

  it('counts against the cap when there is one', async () => {
    const { container } = await render(<Controlled maxSeats={4} />)
    await page.getByRole('checkbox', { name: '12A' }).click()
    await expect.poll(() => region(container)).toBe('12A selected. 1 of 4 seats chosen.')
  })

  it('says so when a seat is cleared', async () => {
    const { container } = await render(<Controlled />)
    await page.getByRole('checkbox', { name: '12A' }).click()
    await page.getByRole('checkbox', { name: '12A' }).click()
    await expect.poll(() => region(container)).toBe('12A cleared. 0 seats chosen.')
  })

  it('explains a refusal rather than staying silent', async () => {
    const { container } = await render(<Controlled />)
    await page.getByRole('checkbox', { name: '12B, taken' }).click({ force: true })
    await expect.poll(() => region(container)).toBe('12B is already taken.')
  })

  it('repeats a refusal when the user tries again', async () => {
    // React only touches a text node when the string changes, so without the
    // alternating trailing space the second attempt would be silent.
    const { container } = await render(<Controlled />)
    const sold = page.getByRole('checkbox', { name: '12B, taken' })
    await sold.click({ force: true })
    const first = container.querySelector('[data-rx-seat-map-announcement]')?.textContent ?? ''
    await sold.click({ force: true })
    await expect
      .poll(() => container.querySelector('[data-rx-seat-map-announcement]')?.textContent)
      .not.toBe(first)
  })

  it('explains the cap', async () => {
    const { container } = await render(<Controlled maxSeats={1} />)
    await page.getByRole('checkbox', { name: '12A' }).click()
    await page.getByRole('checkbox', { name: '12C' }).click()
    await expect.poll(() => region(container)).toBe('You can choose at most 1 seat.')
  })

  it('explains a broken block', async () => {
    const { container } = await render(<Controlled contiguous />)
    await page.getByRole('checkbox', { name: '12A' }).click()
    await page.getByRole('checkbox', { name: '12C' }).click()
    await expect.poll(() => region(container)).toBe('12C is not next to your other seats.')
  })

  it('explains a stranded seat', async () => {
    const { container } = await render(
      <Controlled sections={parseLayout('12: ###')} noOrphanSeats />,
    )
    await page.getByRole('checkbox', { name: '12B' }).click()
    await expect.poll(() => region(container)).toBe('Choosing 12B would leave a single empty seat.')
  })

  it('takes a formatter, so the wording can be localised', async () => {
    const { container } = await render(
      <Controlled
        formatAnnouncement={(event: SeatMapAnnouncement) =>
          event.type === 'selected' ? `Butaca ${event.seat.id} elegida` : 'otra cosa'
        }
      />,
    )
    await page.getByRole('checkbox', { name: '12A' }).click()
    await expect.poll(() => region(container)).toBe('Butaca 12A elegida')
  })

  it('announces a keyboard pick the same way', async () => {
    const { container } = await render(<Controlled />)
    await userEvent.tab()
    await userEvent.keyboard(' ')
    await expect.poll(() => region(container)).toBe('12A selected. 1 seat chosen.')
  })
})
