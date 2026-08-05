import { describe, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { Rating } from '../Rating'

describe('read-only semantics', () => {
  it('is an image conveying a value, not a control', async () => {
    await render(<Rating value={4.3} />)
    await expect.element(page.getByRole('img')).toHaveAttribute('aria-label', '4.3 out of 5')
    expect(page.getByRole('radio').elements()).toHaveLength(0)
  })

  it('announces the snapped value, not the raw one', async () => {
    await render(<Rating value={4.3} precision={1} rounding="nearest" />)
    await expect.element(page.getByRole('img')).toHaveAttribute('aria-label', '4 out of 5')
  })

  it('hides decorative icons from the accessibility tree', async () => {
    const { container } = await render(<Rating value={3} />)
    await expect.element(page.getByRole('img')).toBeInTheDocument()
    const layers = container.querySelectorAll('[data-rx-rating-layer]')
    expect(layers.length).toBeGreaterThan(0)
    for (const layer of layers) expect(layer).toHaveAttribute('aria-hidden', 'true')
  })

  it('takes an explicit label', async () => {
    await render(<Rating value={3} label="Food quality" />)
    await expect.element(page.getByRole('img', { name: 'Food quality' })).toBeInTheDocument()
  })

  it('takes a label formatter', async () => {
    await render(<Rating value={3} formatLabel={(v, m) => `${String(v)}/${String(m)} stars`} />)
    await expect.element(page.getByRole('img', { name: '3/5 stars' })).toBeInTheDocument()
  })

  it('is not in the tab order', async () => {
    await render(
      <>
        <button type="button">before</button>
        <Rating value={3} />
        <button type="button">after</button>
      </>,
    )
    await page.getByRole('button', { name: 'before' }).click()
    await userEvent.tab()
    await expect.element(page.getByRole('button', { name: 'after' })).toHaveFocus()
  })
})

describe('interactive semantics', () => {
  it('exposes a radiogroup of radios', async () => {
    await render(<Rating value={0} onChange={() => undefined} precision={1} label="Rate us" />)
    await expect.element(page.getByRole('radiogroup', { name: 'Rate us' })).toBeInTheDocument()
    expect(page.getByRole('radio').elements()).toHaveLength(5)
  })

  it('marks the selected option checked', async () => {
    await render(<Rating value={3} onChange={() => undefined} precision={1} />)
    await expect.element(page.getByRole('radio', { name: '3 of 5' })).toBeChecked()
    await expect.element(page.getByRole('radio', { name: '2 of 5' })).not.toBeChecked()
  })

  it('names each option accessibly', async () => {
    await render(
      <Rating
        value={0}
        onChange={() => undefined}
        precision={1}
        formatOptionLabel={(v) => `${String(v)} stars`}
      />,
    )
    await expect.element(page.getByRole('radio', { name: '3 stars' })).toBeInTheDocument()
  })

  it('wires invalid state to aria-invalid and aria-describedby', async () => {
    await render(
      <>
        <Rating
          value={0}
          onChange={() => undefined}
          precision={1}
          invalid
          required
          aria-describedby="err"
        />
        <p id="err">Please rate</p>
      </>,
    )
    const group = page.getByRole('radiogroup')
    await expect.element(group).toHaveAttribute('aria-invalid', 'true')
    await expect.element(group).toHaveAttribute('aria-describedby', 'err')
    await expect.element(group).toHaveAttribute('aria-required', 'true')
    await expect.element(group).toHaveAttribute('data-invalid')
  })

  it('stays a radiogroup when disabled rather than degrading to an image', async () => {
    // A disabled control must still be announced as a disabled control. If it
    // collapsed to role="img", a screen-reader user filling the form would
    // never learn the field exists.
    await render(
      <Rating value={2} onChange={() => undefined} precision={1} disabled label="Rate" />,
    )
    await expect.element(page.getByRole('radiogroup', { name: 'Rate' })).toBeInTheDocument()
    await expect.element(page.getByRole('radiogroup')).toHaveAttribute('aria-disabled', 'true')
    await expect.element(page.getByRole('radiogroup')).toHaveAttribute('data-disabled')
    for (const radio of page.getByRole('radio').elements()) {
      expect(radio).toBeDisabled()
    }
  })

  it('still exposes the selected value when disabled', async () => {
    await render(<Rating value={2} onChange={() => undefined} precision={1} disabled />)
    await expect.element(page.getByRole('radio', { name: '2 of 5' })).toBeChecked()
  })

  it('renders a visible focus indicator on the focused icon', async () => {
    const { container } = await render(
      <Rating value={0} onChange={() => undefined} precision={1} />,
    )
    await userEvent.tab()
    const focused = container.querySelector<HTMLElement>('[data-rx-rating-item="0"]')
    expect(focused).not.toBeNull()
    // The ring must not be clipped away by the fill layer's overflow:hidden.
    expect(getComputedStyle(focused!).outlineStyle).not.toBe('none')
  })

  it('gives the root a programmatic focus target for focus-first-error', async () => {
    const { container } = await render(
      <Rating value={0} onChange={() => undefined} precision={1} />,
    )
    const root = container.querySelector<HTMLElement>('[data-rx-rating-root]')!
    expect(root).toHaveAttribute('tabindex', '-1')
    root.focus()
    expect(document.activeElement).toBe(root)
  })
})

describe('target size', () => {
  it('gives whole-star options a 24px+ target at the default size', async () => {
    const { container } = await render(
      <Rating
        value={0}
        onChange={() => undefined}
        precision={1}
        style={{ ['--rx-rating-size' as string]: '24px' }}
      />,
    )
    await expect.element(page.getByRole('radiogroup')).toBeInTheDocument()
    const label = container.querySelector<HTMLElement>('label')!
    const box = label.getBoundingClientRect()
    expect(box.width).toBeGreaterThanOrEqual(24)
    expect(box.height).toBeGreaterThanOrEqual(24)
  })
})

describe('axe', () => {
  async function violations(container: HTMLElement) {
    const axe = (await import('axe-core')).default
    const results = await axe.run(container, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    })
    return results.violations.map((v) => `${v.id}: ${v.help}`)
  }

  it('is clean in read-only mode', async () => {
    const { container } = await render(<Rating value={4.3} label="Average rating" />)
    await expect.element(page.getByRole('img')).toBeInTheDocument()
    expect(await violations(container)).toEqual([])
  })

  it('is clean in interactive mode', async () => {
    const { container } = await render(
      <Rating value={0} onChange={() => undefined} precision={0.5} label="Rate your meal" />,
    )
    await expect.element(page.getByRole('radiogroup')).toBeInTheDocument()
    expect(await violations(container)).toEqual([])
  })

  it('is clean in an invalid, described state', async () => {
    const { container } = await render(
      <>
        <Rating
          value={0}
          onChange={() => undefined}
          precision={1}
          label="Rate"
          invalid
          required
          aria-describedby="e"
        />
        <p id="e">Required</p>
      </>,
    )
    await expect.element(page.getByRole('radiogroup')).toBeInTheDocument()
    expect(await violations(container)).toEqual([])
  })
})

describe('keyboard shortcuts', () => {
  it('jumps to a value with a digit key', async () => {
    const onChange = vi.fn()
    await render(<Rating defaultValue={1} onChange={onChange} precision={1} />)
    await page.getByRole('radio', { name: '1 of 5' }).click()
    onChange.mockClear()
    await userEvent.keyboard('4')
    expect(onChange).toHaveBeenCalledWith(4)
  })

  it('ignores a digit beyond max', async () => {
    const onChange = vi.fn()
    await render(<Rating defaultValue={1} onChange={onChange} precision={1} max={5} />)
    await page.getByRole('radio', { name: '1 of 5' }).click()
    onChange.mockClear()
    await userEvent.keyboard('9')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('re-typing the current value keeps it rather than clearing', async () => {
    const onChange = vi.fn()
    await render(<Rating value={3} onChange={onChange} precision={1} />)
    await page.getByRole('radio', { name: '3 of 5' }).click()
    onChange.mockClear()
    await userEvent.keyboard('3')
    expect(onChange).toHaveBeenCalledWith(3)
  })

  it('clears with Backspace when allowClear', async () => {
    const onChange = vi.fn()
    await render(<Rating value={3} onChange={onChange} precision={1} />)
    await page.getByRole('radio', { name: '3 of 5' }).click()
    onChange.mockClear()
    await userEvent.keyboard('{Backspace}')
    expect(onChange).toHaveBeenCalledWith(0)
  })

  it('does not clear with Backspace when allowClear is false', async () => {
    const onChange = vi.fn()
    await render(<Rating value={3} onChange={onChange} precision={1} allowClear={false} />)
    await page.getByRole('radio', { name: '3 of 5' }).click()
    onChange.mockClear()
    await userEvent.keyboard('{Backspace}')
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('roving tabindex', () => {
  // Browsers only collapse a radio group to one tab stop once something is
  // checked. Without an explicit roving tabindex an unrated half-star widget
  // costs a keyboard user ten tab stops for a single field.
  it('exposes exactly one tab stop when nothing is selected', async () => {
    const { container } = await render(
      <Rating defaultValue={0} onChange={() => undefined} precision={0.5} />,
    )
    await expect.element(page.getByRole('radiogroup')).toBeInTheDocument()
    const tabbable = [...container.querySelectorAll('input[type=radio]')].filter(
      (el) => el.getAttribute('tabindex') === '0',
    )
    expect(tabbable).toHaveLength(1)
    expect(tabbable[0]).toHaveAttribute('value', '0.5')
  })

  it('moves the tab stop onto the selected value', async () => {
    const { container } = await render(
      <Rating value={3} onChange={() => undefined} precision={1} />,
    )
    await expect.element(page.getByRole('radiogroup')).toBeInTheDocument()
    const tabbable = [...container.querySelectorAll('input[type=radio]')].filter(
      (el) => el.getAttribute('tabindex') === '0',
    )
    expect(tabbable).toHaveLength(1)
    expect(tabbable[0]).toHaveAttribute('value', '3')
  })

  it('leaves an unrated group in one Tab press', async () => {
    await render(
      <>
        <button type="button">before</button>
        <Rating defaultValue={0} onChange={() => undefined} precision={0.5} />
        <button type="button">after</button>
      </>,
    )
    await page.getByRole('button', { name: 'before' }).click()
    await userEvent.tab()
    expect(document.activeElement).toHaveAttribute('type', 'radio')
    await userEvent.tab()
    await expect.element(page.getByRole('button', { name: 'after' })).toHaveFocus()
  })
})
