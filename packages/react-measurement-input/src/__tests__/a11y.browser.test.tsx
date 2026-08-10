import { describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { MeasurementInput } from '../MeasurementInput'
import type { MeasurementUnit } from '../units'

/**
 * Accessibility here is almost entirely a question of what the platform is told,
 * not of what this component reimplements. So these assertions are about the
 * accessibility tree — roles, names, values — rather than about behaviour that
 * happens to be reachable by keyboard.
 *
 * The comparison worth keeping in mind: the npm alternatives to this field are
 * conversion *libraries* with no UI at all, so the accessible representation of
 * `5 ft 11 in` is whatever each consumer improvises around them.
 */

function seg(container: HTMLElement, unit: MeasurementUnit) {
  return container.querySelector<HTMLElement>(`[data-rx-measurement-segment="${unit}"]`)!
}

describe('roles and names', () => {
  it('is a group containing one spinbutton per unit', async () => {
    const { container } = await render(
      <MeasurementInput label="Height" locale="en-GB" units={['foot', 'inch']} />,
    )
    const group = container.querySelector('[data-rx-measurement-root]')!
    expect(group.getAttribute('role')).toBe('group')
    expect(group.getAttribute('aria-label')).toBe('Height')
    expect(container.querySelectorAll('[role="spinbutton"]')).toHaveLength(2)
  })

  /**
   * The visible suffix is an abbreviation chosen for width. A screen reader
   * announcing "ft" would tell the user nothing about which box they are in, so
   * the accessible name is the locale's word instead.
   */
  it('names each segment with the locale word, not the abbreviation', async () => {
    const { container } = await render(
      <MeasurementInput label="Height" locale="en-GB" units={['foot', 'inch']} />,
    )
    expect(seg(container, 'foot').getAttribute('aria-label')).toBe('feet')
    expect(seg(container, 'inch').getAttribute('aria-label')).toBe('inches')
  })

  it('translates the segment names with the locale', async () => {
    const { container } = await render(
      <MeasurementInput label="Height" locale="fr-FR" units={['meter', 'centimeter']} />,
    )
    expect(seg(container, 'meter').getAttribute('aria-label')).toBe('mètres')
  })

  it('lets the caller override a segment name', async () => {
    const { container } = await render(
      <MeasurementInput
        label="Height"
        locale="en-GB"
        units={['foot', 'inch']}
        unitLabels={{ inch: 'Inches over the foot' }}
      />,
    )
    expect(seg(container, 'inch').getAttribute('aria-label')).toBe('Inches over the foot')
  })

  it('hides the suffixes from the accessibility tree', async () => {
    const { container } = await render(
      <MeasurementInput label="Height" locale="en-GB" units={['foot', 'inch']} />,
    )
    for (const element of container.querySelectorAll('[data-rx-measurement-root] > span')) {
      if (
        !element.hasAttribute('data-rx-measurement-segment') &&
        element.textContent?.trim() !== ''
      ) {
        expect(element.getAttribute('aria-hidden')).toBe('true')
      }
    }
  })

  it('takes a non-string label through aria-labelledby', async () => {
    const { container } = await render(
      <MeasurementInput label={<span>Your height</span>} locale="en-GB" units={['foot', 'inch']} />,
    )
    const group = container.querySelector('[data-rx-measurement-root]')!
    const id = group.getAttribute('aria-labelledby')
    expect(id).not.toBeNull()
    expect(container.querySelector(`#${CSS.escape(id ?? '')}`)?.textContent).toBe('Your height')
  })
})

describe('values', () => {
  it('announces a filled segment as a quantity, not a bare number', async () => {
    const { container } = await render(
      <MeasurementInput
        label="Height"
        locale="en-GB"
        units={['foot', 'inch']}
        defaultValue="71 inch"
      />,
    )
    expect(seg(container, 'foot').getAttribute('aria-valuenow')).toBe('5')
    expect(seg(container, 'foot').getAttribute('aria-valuetext')).toBe('5 feet')
    expect(seg(container, 'inch').getAttribute('aria-valuetext')).toBe('11 inches')
  })

  it('announces the placeholder rather than nothing while empty', async () => {
    const { container } = await render(
      <MeasurementInput label="Height" locale="en-GB" units={['foot', 'inch']} />,
    )
    expect(seg(container, 'foot').hasAttribute('aria-valuenow')).toBe(false)
    expect(seg(container, 'foot').getAttribute('aria-valuetext')).toBe('--')
  })

  /**
   * `aria-valuemin` and `aria-valuemax` are promises about the ends. The leading
   * segment has no ceiling and a temperature has no floor, so the attribute is
   * omitted rather than filled with a number that is not true.
   */
  it('omits a bound that does not exist', async () => {
    const { container } = await render(
      <MeasurementInput label="Height" locale="en-GB" units={['foot', 'inch']} />,
    )
    expect(seg(container, 'foot').hasAttribute('aria-valuemax')).toBe(false)
    expect(seg(container, 'inch').getAttribute('aria-valuemax')).toBe('11')
    expect(seg(container, 'inch').getAttribute('aria-valuemin')).toBe('0')

    const temperature = await render(
      <MeasurementInput label="T" locale="en-GB" units={['celsius']} />,
    )
    expect(seg(temperature.container, 'celsius').hasAttribute('aria-valuemin')).toBe(false)
    expect(seg(temperature.container, 'celsius').hasAttribute('aria-valuemax')).toBe(false)
  })

  it('reports a decimal ceiling that matches what the segment can hold', async () => {
    const { container } = await render(
      <MeasurementInput label="Height" locale="en-GB" units={['foot', 'inch']} precision={1} />,
    )
    // 11, not 11.9, would make the last tenth of a foot unreachable.
    expect(seg(container, 'inch').getAttribute('aria-valuemax')).toBe('11.9')
  })
})

describe('states', () => {
  it('marks itself invalid, disabled and read-only for assistive technology', async () => {
    const { container } = await render(
      <MeasurementInput
        label="Height"
        locale="en-GB"
        units={['foot', 'inch']}
        invalid
        readOnly
        required
      />,
    )
    const group = container.querySelector('[data-rx-measurement-root]')!
    expect(group.getAttribute('aria-required')).toBe('true')
    expect(seg(container, 'foot').getAttribute('aria-invalid')).toBe('true')
    expect(seg(container, 'foot').getAttribute('aria-readonly')).toBe('true')

    const disabled = await render(
      <MeasurementInput label="H" locale="en-GB" units={['foot', 'inch']} disabled />,
    )
    expect(
      disabled.container.querySelector('[data-rx-measurement-root]')?.getAttribute('aria-disabled'),
    ).toBe('true')
  })

  it('carries an external description through', async () => {
    const { container } = await render(
      <>
        <MeasurementInput
          label="Height"
          locale="en-GB"
          units={['foot', 'inch']}
          aria-describedby="hint"
        />
        <p id="hint">Roughly, is fine.</p>
      </>,
    )
    expect(
      container.querySelector('[data-rx-measurement-root]')?.getAttribute('aria-describedby'),
    ).toBe('hint')
  })
})

describe('keyboard', () => {
  it('puts every segment in the tab order, in reading order', async () => {
    const { container } = await render(
      <>
        <button type="button">before</button>
        <MeasurementInput label="Height" locale="en-GB" units={['foot', 'inch']} />
        <button type="button">after</button>
      </>,
    )
    await userEvent.click(page.getByRole('button', { name: 'before' }))
    await userEvent.tab()
    expect(document.activeElement).toBe(seg(container, 'foot'))
    await userEvent.tab()
    expect(document.activeElement).toBe(seg(container, 'inch'))
    await userEvent.tab()
    expect(document.activeElement).toBe(page.getByRole('button', { name: 'after' }).element())
  })

  it('takes every segment out of the tab order while disabled', async () => {
    const { container } = await render(
      <MeasurementInput label="Height" locale="en-GB" units={['foot', 'inch']} disabled />,
    )
    for (const element of container.querySelectorAll('[role="spinbutton"]')) {
      expect(element.getAttribute('tabindex')).toBe('-1')
    }
  })
})
