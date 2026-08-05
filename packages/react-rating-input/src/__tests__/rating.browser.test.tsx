import { describe, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { Rating } from '../Rating'

/**
 * Measured fill ratio for one icon, from real layout rather than markup.
 * This is the assertion jsdom cannot make: it has no layout engine, so a
 * jsdom test of a partial fill would only be re-reading the style string we
 * just wrote.
 */
function fillRatio(container: HTMLElement, index: number): number {
  const item = container.querySelector<HTMLElement>(`[data-rx-rating-item="${String(index)}"]`)
  if (!item) throw new Error(`no item at index ${String(index)}`)
  const fill = item.querySelector<HTMLElement>('[data-rx-rating-layer="fill"]')
  if (!fill) throw new Error('no fill layer')
  return fill.getBoundingClientRect().width / item.getBoundingClientRect().width
}

describe('rendering', () => {
  it('renders max icons', async () => {
    const { container } = await render(<Rating value={3} max={7} />)
    await expect.element(page.getByRole('img')).toBeInTheDocument()
    expect(container.querySelectorAll('[data-rx-rating-item]')).toHaveLength(7)
  })

  it('measures a partial fill from real layout', async () => {
    const { container } = await render(<Rating value={4.3} />)
    await expect.element(page.getByRole('img')).toBeInTheDocument()

    expect(fillRatio(container, 0)).toBeCloseTo(1, 2)
    expect(fillRatio(container, 3)).toBeCloseTo(1, 2)
    expect(fillRatio(container, 4)).toBeCloseTo(0.3, 2)
  })

  it.each([
    [0, 0],
    [0.25, 0.25],
    [0.5, 0.5],
    [0.75, 0.75],
    [1, 1],
  ])('fills the first icon to %p', async (value, expected) => {
    const { container } = await render(<Rating value={value} />)
    await expect.element(page.getByRole('img')).toBeInTheDocument()
    expect(fillRatio(container, 0)).toBeCloseTo(expected, 2)
  })

  it('sets data-state per icon', async () => {
    const { container } = await render(<Rating value={2.5} />)
    await expect.element(page.getByRole('img')).toBeInTheDocument()
    const states = [...container.querySelectorAll('[data-rx-rating-item]')].map((el) =>
      el.getAttribute('data-state'),
    )
    expect(states).toEqual(['full', 'full', 'partial', 'empty', 'empty'])
  })

  it('applies rounding before painting', async () => {
    const { container } = await render(<Rating value={4.3} precision={1} rounding="up" />)
    await expect.element(page.getByRole('img')).toBeInTheDocument()
    expect(fillRatio(container, 4)).toBeCloseTo(1, 2)
  })

  it('never overflows its container at max', async () => {
    const { container } = await render(<Rating value={5} />)
    await expect.element(page.getByRole('img')).toBeInTheDocument()
    const root = container.querySelector<HTMLElement>('[data-rx-rating-root]')!
    expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth + 1)
  })
})

describe('icon sources render identically', () => {
  it.each([
    ['emoji', <>⭐</>],
    ['ZWJ emoji', <>👩‍🍳</>],
    ['variation selector emoji', <>❤️</>],
    ['inline svg', <svg viewBox="0 0 10 10" width="1em" height="1em" />],
    ['arbitrary jsx', <b>X</b>],
  ])('%s partial-fills to the same geometry', async (_name, node) => {
    const { container } = await render(<Rating value={2.5} icon={node} />)
    await expect.element(page.getByRole('img')).toBeInTheDocument()
    expect(fillRatio(container, 0)).toBeCloseTo(1, 2)
    expect(fillRatio(container, 2)).toBeCloseTo(0.5, 2)
    expect(fillRatio(container, 4)).toBeCloseTo(0, 2)
  })

  it('does not squash the icon inside the clip', async () => {
    const { container } = await render(<Rating value={0.5} icon={<svg data-testid="g" />} />)
    await expect.element(page.getByRole('img')).toBeInTheDocument()
    const item = container.querySelector<HTMLElement>('[data-rx-rating-item="0"]')!
    const inner = item.querySelector<HTMLElement>('[data-rx-rating-layer="fill"] > span')!
    // The clip is half the item wide, but the icon inside keeps full width.
    expect(inner.getBoundingClientRect().width).toBeCloseTo(item.getBoundingClientRect().width, 0)
  })

  it('dims the implicit empty layer but leaves an explicit one alone', async () => {
    const implicit = await render(<Rating value={0} icon="X" />)
    await expect.element(page.getByRole('img')).toBeInTheDocument()
    const a = implicit.container.querySelector<HTMLElement>('[data-rx-rating-layer="empty"]')!
    expect(getComputedStyle(a).filter).not.toBe('none')

    const explicit = await render(<Rating value={0} icon="X" emptyIcon="O" />)
    const b = explicit.container.querySelectorAll<HTMLElement>('[data-rx-rating-layer="empty"]')
    expect(getComputedStyle(b[b.length - 1]!).filter).toBe('none')
  })
})

describe('rtl', () => {
  it('fills from the right edge', async () => {
    const { container } = await render(<Rating value={0.5} dir="rtl" />)
    await expect.element(page.getByRole('img')).toBeInTheDocument()
    const item = container.querySelector<HTMLElement>('[data-rx-rating-item="0"]')!
    const fill = item.querySelector<HTMLElement>('[data-rx-rating-layer="fill"]')!
    const itemBox = item.getBoundingClientRect()
    const fillBox = fill.getBoundingClientRect()

    expect(fillBox.width).toBeCloseTo(itemBox.width / 2, 0)
    // Right edges coincide; left edges do not.
    expect(fillBox.right).toBeCloseTo(itemBox.right, 0)
    expect(fillBox.left).toBeGreaterThan(itemBox.left + 1)
  })

  it('fills from the left edge in ltr', async () => {
    const { container } = await render(<Rating value={0.5} dir="ltr" />)
    await expect.element(page.getByRole('img')).toBeInTheDocument()
    const item = container.querySelector<HTMLElement>('[data-rx-rating-item="0"]')!
    const fill = item.querySelector<HTMLElement>('[data-rx-rating-layer="fill"]')!
    expect(fill.getBoundingClientRect().left).toBeCloseTo(item.getBoundingClientRect().left, 0)
  })
})

describe('interaction', () => {
  it('is read-only with no onChange', async () => {
    const { container } = await render(<Rating value={3} />)
    await expect.element(page.getByRole('img')).toBeInTheDocument()
    expect(container.querySelectorAll('input')).toHaveLength(0)
  })

  it('becomes a radiogroup when onChange is given', async () => {
    await render(<Rating value={3} onChange={() => undefined} precision={1} />)
    await expect.element(page.getByRole('radiogroup')).toBeInTheDocument()
    expect(page.getByRole('radio').elements()).toHaveLength(5)
  })

  it('commits a click', async () => {
    const onChange = vi.fn()
    await render(<Rating defaultValue={0} onChange={onChange} precision={1} />)
    await page.getByRole('radio', { name: '4 of 5' }).click()
    expect(onChange).toHaveBeenCalledWith(4)
  })

  it('offers half steps at precision 0.5', async () => {
    await render(<Rating defaultValue={0} onChange={() => undefined} precision={0.5} />)
    await expect.element(page.getByRole('radiogroup')).toBeInTheDocument()
    expect(page.getByRole('radio').elements()).toHaveLength(10)
    await expect.element(page.getByRole('radio', { name: '2.5 of 5' })).toBeInTheDocument()
  })

  it('updates an uncontrolled value', async () => {
    const { container } = await render(
      <>
        <h1>away</h1>
        <Rating defaultValue={0} onChange={() => undefined} precision={1} />
      </>,
    )
    await page.getByRole('radio', { name: '3 of 5' }).click()

    // The cursor is physically parked on the widget after the click, so the
    // paint still shows a hover preview. Move off before measuring committed
    // state, or this asserts the preview instead of the value.
    await page.getByRole('heading', { name: 'away' }).hover()

    // The fill width is transitioned, so measuring synchronously samples the
    // animation mid-flight. Settle first.
    await vi.waitFor(() => {
      expect(fillRatio(container, 2)).toBeCloseTo(1, 2)
    })
    expect(fillRatio(container, 3)).toBeCloseTo(0, 2)
  })

  it('does not move a controlled value on its own', async () => {
    const { container } = await render(
      <>
        <h1>away</h1>
        <Rating value={1} onChange={() => undefined} precision={1} />
      </>,
    )
    await page.getByRole('radio', { name: '4 of 5' }).click()

    // The cursor stays parked on the 4th icon after the click, so the paint
    // still shows a hover preview filling up to it. Move off before measuring,
    // or this samples the preview instead of the committed (controlled) value.
    await page.getByRole('heading', { name: 'away' }).hover()

    // The fill width is transitioned, so it settles back to the controlled
    // value over a frame or two — waitFor rather than sampling mid-flight.
    await vi.waitFor(() => {
      expect(fillRatio(container, 3)).toBeCloseTo(0, 2)
    })
  })

  it('clears when the selected value is re-selected', async () => {
    const onChange = vi.fn()
    await render(<Rating value={3} onChange={onChange} precision={1} />)
    await page.getByRole('radio', { name: '3 of 5' }).click()
    expect(onChange).toHaveBeenCalledWith(0)
  })

  it('does not clear when allowClear is false', async () => {
    const onChange = vi.fn()
    await render(<Rating value={3} onChange={onChange} precision={1} allowClear={false} />)
    await page.getByRole('radio', { name: '3 of 5' }).click()
    expect(onChange).toHaveBeenCalledWith(3)
  })

  it('previews on hover and restores on leave', async () => {
    const onHoverChange = vi.fn()
    const { container } = await render(
      <>
        <h1>away</h1>
        <Rating value={1} onChange={() => undefined} onHoverChange={onHoverChange} precision={1} />
      </>,
    )
    await page.getByRole('radio', { name: '4 of 5' }).hover()
    await vi.waitFor(() => {
      expect(fillRatio(container, 3)).toBeCloseTo(1, 2)
    })
    expect(onHoverChange).toHaveBeenCalledWith(4)

    // Moving the pointer off the group must restore the committed value.
    await page.getByRole('heading', { name: 'away' }).hover()
    await vi.waitFor(() => {
      expect(fillRatio(container, 3)).toBeCloseTo(0, 2)
    })
    expect(onHoverChange).toHaveBeenLastCalledWith(null)
  })

  it('ignores input when disabled', async () => {
    const onChange = vi.fn()
    const { container } = await render(
      <Rating value={2} onChange={onChange} precision={1} disabled />,
    )
    await expect.element(page.getByRole('radiogroup')).toBeInTheDocument()

    // Disabled inputs swallow clicks natively; assert nothing commits and the
    // paint does not preview either.
    await page.getByRole('radio', { name: '4 of 5' }).click({ force: true })
    expect(onChange).not.toHaveBeenCalled()
    expect(fillRatio(container, 3)).toBeCloseTo(0, 2)
  })

  it('does not hover-preview when disabled', async () => {
    const onHoverChange = vi.fn()
    const { container } = await render(
      <Rating
        value={1}
        onChange={() => undefined}
        onHoverChange={onHoverChange}
        precision={1}
        disabled
      />,
    )
    await expect.element(page.getByRole('radiogroup')).toBeInTheDocument()
    await page.getByRole('radio', { name: '4 of 5' }).hover({ force: true })
    expect(onHoverChange).not.toHaveBeenCalled()
    expect(fillRatio(container, 3)).toBeCloseTo(0, 2)
  })

  it('honours readOnly even with onChange present', async () => {
    const { container } = await render(<Rating value={2} onChange={() => undefined} readOnly />)
    await expect.element(page.getByRole('img')).toBeInTheDocument()
    expect(container.querySelectorAll('input')).toHaveLength(0)
  })
})

describe('keyboard', () => {
  it('moves selection with arrow keys', async () => {
    const onChange = vi.fn()
    await render(<Rating defaultValue={2} onChange={onChange} precision={1} />)

    // Clicking focuses the radio; native radiogroup semantics then give us
    // arrow navigation for free, which is the whole reason for real inputs.
    await page.getByRole('radio', { name: '2 of 5' }).click()
    onChange.mockClear()

    await userEvent.keyboard('{ArrowRight}')
    expect(onChange).toHaveBeenCalledWith(3)

    onChange.mockClear()
    await userEvent.keyboard('{ArrowLeft}')
    expect(onChange).toHaveBeenCalledWith(2)
  })

  it('reaches the group with Tab and leaves it in one more Tab', async () => {
    await render(
      <>
        <button type="button">before</button>
        <Rating defaultValue={3} onChange={() => undefined} precision={1} />
        <button type="button">after</button>
      </>,
    )
    await page.getByRole('button', { name: 'before' }).click()
    await userEvent.tab()
    expect(document.activeElement).toHaveAttribute('type', 'radio')

    // A radiogroup is a single tab stop, not five.
    await userEvent.tab()
    await expect.element(page.getByRole('button', { name: 'after' })).toHaveFocus()
  })
})

describe('cursor consistency', () => {
  /** Computed cursor at the midpoint of the gap between the first two icons. */
  function gapCursor(container: HTMLElement): string {
    const items = container.querySelectorAll<HTMLElement>('[data-rx-rating-item]')
    const first = items[0]!.getBoundingClientRect()
    const second = items[1]!.getBoundingClientRect()
    const el = document.elementFromPoint(
      (first.right + second.left) / 2,
      first.y + first.height / 2,
    )
    if (!el) throw new Error('nothing at the gap point')
    return getComputedStyle(el).cursor
  }

  it('shows the pointer in the gap between icons, same as on an icon', async () => {
    const { container } = await render(<Rating value={2} onChange={() => undefined} />)
    await expect.element(page.getByRole('radiogroup')).toBeInTheDocument()
    expect(gapCursor(container)).toBe('pointer')
  })

  it('shows not-allowed in the gap when disabled', async () => {
    const { container } = await render(<Rating value={2} onChange={() => undefined} disabled />)
    await expect.element(page.getByRole('radiogroup')).toBeInTheDocument()
    expect(gapCursor(container)).toBe('not-allowed')
  })

  it('keeps the default cursor when read-only', async () => {
    const { container } = await render(<Rating value={2} />)
    await expect.element(page.getByRole('img')).toBeInTheDocument()
    expect(gapCursor(container)).toBe('auto')
  })
})

describe('uncovered API surface', () => {
  it('accepts a render function for icon and gets per-icon state', async () => {
    const seen: { index: number; fill: number; partial: boolean }[] = []
    const { container } = await render(
      <Rating
        value={2.5}
        icon={(s) => {
          seen.push({ index: s.index, fill: s.fill, partial: s.partial })
          return <b data-fill={s.fill}>{s.partial ? 'P' : s.filled ? 'F' : 'E'}</b>
        }}
      />,
    )
    await expect.element(page.getByRole('img')).toBeInTheDocument()

    expect(seen.map((s) => s.index)).toEqual(expect.arrayContaining([0, 1, 2, 3, 4]))
    expect(seen.find((s) => s.index === 2)?.partial).toBe(true)
    expect(seen.find((s) => s.index === 0)?.fill).toBe(1)
    expect(fillRatio(container, 2)).toBeCloseTo(0.5, 2)
  })

  it('accepts a render function for emptyIcon', async () => {
    const { container } = await render(
      <Rating value={1} icon={<b>F</b>} emptyIcon={(s) => <i data-idx={s.index}>E</i>} />,
    )
    await expect.element(page.getByRole('img')).toBeInTheDocument()
    expect(container.querySelectorAll('i[data-idx]')).toHaveLength(5)
  })

  it('populates an object ref as well as a callback ref', async () => {
    const objectRef = { current: null as HTMLSpanElement | null }
    await render(<Rating value={3} ref={objectRef} />)
    await expect.element(page.getByRole('img')).toBeInTheDocument()
    expect(objectRef.current).toBeInstanceOf(HTMLElement)
    expect(objectRef.current).toHaveAttribute('data-rx-rating-root')
  })

  it('ignores touch pointers for hover preview', async () => {
    const onHoverChange = vi.fn()
    const { container } = await render(
      <>
        <h1>away</h1>
        <Rating value={1} onChange={() => undefined} onHoverChange={onHoverChange} precision={1} />
      </>,
    )
    await expect.element(page.getByRole('radiogroup')).toBeInTheDocument()
    // Park the real cursor off the widget first, or its genuine pointerenter
    // fires alongside the synthetic events below.
    await page.getByRole('heading', { name: 'away' }).hover()
    onHoverChange.mockClear()
    const label = container.querySelectorAll<HTMLElement>('label')[3]!

    // A touch "hover" would leave a sticky preview after the finger lifts, so
    // the handler bails on pointerType touch. React derives onPointerEnter
    // from pointerover, which is why this dispatches that rather than the
    // non-bubbling pointerenter.
    label.dispatchEvent(new PointerEvent('pointerover', { pointerType: 'touch', bubbles: true }))
    expect(onHoverChange).not.toHaveBeenCalled()

    // A real mouse over the same target does preview.
    await page.getByRole('radio', { name: '4 of 5' }).hover()
    expect(onHoverChange).toHaveBeenCalledWith(4)
  })

  it('leaves modifier-key combinations to the browser', async () => {
    const onChange = vi.fn()
    await render(<Rating value={1} onChange={onChange} precision={1} />)
    await page.getByRole('radio', { name: '1 of 5' }).click()
    onChange.mockClear()

    // Ctrl+4 etc. belong to the user agent, not to us.
    await userEvent.keyboard('{Control>}4{/Control}')
    expect(onChange).not.toHaveBeenCalled()
  })
})
