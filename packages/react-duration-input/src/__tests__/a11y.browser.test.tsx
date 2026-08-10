import { describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { DurationInput } from '../DurationInput'
import type { DurationUnit } from '../duration'

/**
 * Accessibility here is almost entirely a question of what the platform is told,
 * not of what this component reimplements. So these assertions are about the
 * accessibility tree — roles, names, values — rather than about behaviour that
 * happens to be reachable by keyboard.
 *
 * The comparison worth keeping in mind: not one of the six duration packages on
 * npm mentions `aria`, `role=`, `tabindex` or `accessib` anywhere in its README.
 */

function seg(container: HTMLElement, unit: DurationUnit) {
  return container.querySelector<HTMLElement>(`[data-rx-duration-segment="${unit}"]`)!
}

describe('roles and names', () => {
  it('is a group containing one spinbutton per unit', async () => {
    const { container } = await render(
      <DurationInput label="Session length" locale="en-GB" units={['hour', 'minute']} />,
    )
    const group = container.querySelector('[data-rx-duration-root]')!
    expect(group.getAttribute('role')).toBe('group')
    expect(group.getAttribute('aria-label')).toBe('Session length')
    expect(container.querySelectorAll('[role="spinbutton"]')).toHaveLength(2)
  })

  /**
   * The visible suffix is an abbreviation chosen for width. A screen reader
   * announcing "h" would tell the user nothing about which box they are in, so
   * the accessible name is the locale's word instead.
   */
  it('names each segment with the locale word, not the abbreviation', async () => {
    const { container } = await render(<DurationInput label="Duration" locale="en-GB" />)
    expect(seg(container, 'hour').getAttribute('aria-label')).toBe('hours')
    expect(seg(container, 'minute').getAttribute('aria-label')).toBe('minutes')
  })

  it('translates the segment names with the locale', async () => {
    const { container } = await render(<DurationInput label="Duration" locale="de-DE" />)
    expect(seg(container, 'hour').getAttribute('aria-label')).toBe('Stunden')
  })

  it('lets the caller override a segment name', async () => {
    const { container } = await render(
      <DurationInput label="Duration" locale="en-GB" unitLabels={{ minute: 'Minutes past' }} />,
    )
    expect(seg(container, 'minute').getAttribute('aria-label')).toBe('Minutes past')
  })

  it('hides the suffixes from the accessibility tree', async () => {
    const { container } = await render(<DurationInput label="Duration" locale="en-GB" />)
    for (const element of container.querySelectorAll('[data-rx-duration-root] > span')) {
      if (!element.hasAttribute('data-rx-duration-segment') && element.textContent?.trim() !== '') {
        expect(element.getAttribute('aria-hidden')).toBe('true')
      }
    }
  })

  it('accepts a non-string label through aria-labelledby', async () => {
    const { container } = await render(
      <DurationInput
        label={
          <>
            Session <em>length</em>
          </>
        }
        locale="en-GB"
      />,
    )
    const group = container.querySelector('[data-rx-duration-root]')!
    const id = group.getAttribute('aria-labelledby')
    expect(id).not.toBeNull()
    expect(container.querySelector(`#${CSS.escape(id!)}`)?.textContent).toContain('Session')
  })
})

describe('values', () => {
  it('reports the number with its unit, not a bare digit', async () => {
    const { container } = await render(
      <DurationInput label="Duration" locale="en-GB" defaultValue="PT2H30M" />,
    )
    expect(seg(container, 'hour').getAttribute('aria-valuenow')).toBe('2')
    expect(seg(container, 'hour').getAttribute('aria-valuetext')).toBe('2 hours')
  })

  it('announces the placeholder rather than nothing while empty', async () => {
    const { container } = await render(<DurationInput label="Duration" locale="en-GB" />)
    expect(seg(container, 'hour').getAttribute('aria-valuenow')).toBeNull()
    expect(seg(container, 'hour').getAttribute('aria-valuetext')).toBe('hh')
  })

  it('bounds each trailing segment', async () => {
    const { container } = await render(
      <DurationInput label="Duration" locale="en-GB" units={['day', 'hour', 'minute']} />,
    )
    expect(seg(container, 'hour').getAttribute('aria-valuemax')).toBe('23')
    expect(seg(container, 'minute').getAttribute('aria-valuemax')).toBe('59')
  })

  /**
   * `aria-valuemax` is a promise about the ceiling. The leading unit has none,
   * so the attribute is omitted rather than set to a number that would be a lie
   * the moment someone types past it.
   */
  it('omits aria-valuemax on the unbounded leading segment', async () => {
    const { container } = await render(
      <DurationInput label="Duration" locale="en-GB" units={['hour', 'minute']} />,
    )
    expect(seg(container, 'hour').hasAttribute('aria-valuemax')).toBe(false)
    expect(seg(container, 'hour').getAttribute('aria-valuemin')).toBe('0')
  })
})

describe('state', () => {
  it('marks the group and every segment invalid together', async () => {
    const { container } = await render(
      <DurationInput label="Duration" locale="en-GB" invalid defaultValue="PT1H" />,
    )
    expect(container.querySelector('[data-rx-duration-root]')?.getAttribute('aria-invalid')).toBe(
      null,
    )
    expect(container.querySelector('[data-rx-duration-root]')?.hasAttribute('data-invalid')).toBe(
      true,
    )
    expect(seg(container, 'hour').getAttribute('aria-invalid')).toBe('true')
  })

  it('carries required as aria-required on the group', async () => {
    const { container } = await render(
      <DurationInput label="Duration" locale="en-GB" required name="d" />,
    )
    expect(container.querySelector('[data-rx-duration-root]')?.getAttribute('aria-required')).toBe(
      'true',
    )
    // Not on the hidden input: a hidden input is barred from constraint
    // validation, so `required` there would look like it was doing something.
    expect(container.querySelector('[data-rx-duration-value]')?.hasAttribute('required')).toBe(
      false,
    )
  })

  it('marks a disabled field on the group and takes every segment out of the tab order', async () => {
    const { container } = await render(
      <DurationInput label="Duration" locale="en-GB" disabled defaultValue="PT1H" />,
    )
    expect(container.querySelector('[data-rx-duration-root]')?.getAttribute('aria-disabled')).toBe(
      'true',
    )
    expect(seg(container, 'hour').getAttribute('tabindex')).toBe('-1')
  })

  it('passes aria-describedby straight through', async () => {
    const { container } = await render(
      <>
        <DurationInput label="Duration" locale="en-GB" aria-describedby="hint" />
        <p id="hint">Round up to the nearest quarter hour.</p>
      </>,
    )
    expect(
      container.querySelector('[data-rx-duration-root]')?.getAttribute('aria-describedby'),
    ).toBe('hint')
  })
})

describe('keyboard', () => {
  it('is fully operable with no pointer at all', async () => {
    const { container } = await render(
      <DurationInput label="Duration" locale="en-GB" units={['hour', 'minute']} />,
    )
    await userEvent.keyboard('{Tab}')
    expect(document.activeElement).toBe(seg(container, 'hour'))
    await userEvent.keyboard('2')
    await userEvent.keyboard('{ArrowRight}')
    expect(document.activeElement).toBe(seg(container, 'minute'))
    await userEvent.keyboard('{ArrowUp}')
    expect(seg(container, 'minute').textContent).toBe('00')
  })

  it('paints a focus ring, because a span role=spinbutton gets none', async () => {
    const { container } = await render(<DurationInput label="Duration" locale="en-GB" />)
    await userEvent.click(seg(container, 'hour'))
    expect(seg(container, 'hour').hasAttribute('data-focused')).toBe(true)
    expect(getComputedStyle(seg(container, 'hour')).outlineStyle).not.toBe('none')
  })

  it('gives each instance its own ids, so two on a page do not collide', async () => {
    const { container } = await render(
      <>
        <DurationInput label="First" locale="en-GB" />
        <DurationInput label="Second" locale="en-GB" />
      </>,
    )
    const ids = Array.from(container.querySelectorAll('[data-rx-duration-segment]')).map(
      (element) => element.id,
    )
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('derives segment ids from a given id', async () => {
    const { container } = await render(
      <DurationInput label="Duration" locale="en-GB" id="how-long" />,
    )
    expect(seg(container, 'hour').id).toBe('how-long-hour')
    expect(seg(container, 'minute').id).toBe('how-long-minute')
  })

  it('leaves modified keys to the browser', async () => {
    const { container } = await render(
      <DurationInput label="Duration" locale="en-GB" defaultValue="PT1H30M" />,
    )
    await userEvent.click(seg(container, 'minute'))
    await userEvent.keyboard('{Control>}{ArrowUp}{/Control}')
    expect(seg(container, 'minute').textContent).toBe('30')
  })
})

describe('page composition', () => {
  it('keeps a natural tab order across two fields and a button', async () => {
    await render(
      <>
        <DurationInput label="First" locale="en-GB" units={['minute']} />
        <DurationInput label="Second" locale="en-GB" units={['minute']} />
        <button type="button">After</button>
      </>,
    )
    await userEvent.keyboard('{Tab}')
    await userEvent.keyboard('{Tab}')
    await userEvent.keyboard('{Tab}')
    await expect.element(page.getByRole('button', { name: 'After' })).toHaveFocus()
  })
})
