import { describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
// Static import so Vite pre-bundles axe-core with the other deps; a dynamic
// import triggers a mid-run optimize + reload that flakes the axe specs.
import axe from 'axe-core'
import { PhoneInput } from '../PhoneInput'

async function violations(container: HTMLElement) {
  const results = await axe.run(container, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
  })
  return results.violations.map((v) => `${v.id}: ${v.help}`)
}

describe('semantics', () => {
  it('is a real labelled tel input beside a real select', async () => {
    // Both are native controls on purpose. The browser gives keyboard support,
    // form participation, autofill and — on mobile — its own country picker,
    // none of which a custom listbox of 234 options can match.
    const { container } = await render(<PhoneInput label="Phone number" name="phone" />)
    const box = container.querySelector('[data-rx-phone-input]')!
    expect(box.tagName).toBe('INPUT')
    expect(box).toHaveAttribute('type', 'tel')
    expect(box).toHaveAttribute('inputmode', 'tel')
    expect(box).toHaveAttribute('autocomplete', 'tel')
    await expect.element(page.getByLabelText('Phone number')).toBeInTheDocument()
    expect(container.querySelector('[data-rx-phone-country]')?.tagName).toBe('SELECT')
  })

  it('names the field without rendering a <label> element', async () => {
    // `label` is the accessible name, the same as it is on every other input in
    // the suite. A component that also painted a visible <label> would be a
    // layout decision the caller never asked for, and one its neighbours do not
    // make — so a form built from two of them could not line up.
    const { container } = await render(<PhoneInput label="Phone number" />)

    expect(container.querySelector('label')).toBeNull()
    expect(container.querySelector('[data-rx-phone-input]')).toHaveAccessibleName('Phone number')
  })

  it('takes a node label through a hidden element rather than dropping it', async () => {
    const { container } = await render(
      <PhoneInput
        label={
          <>
            Phone <abbr title="required">*</abbr>
          </>
        }
      />,
    )

    expect(container.querySelector('label')).toBeNull()
    expect(container.querySelector('[data-rx-phone-input]')).toHaveAccessibleName('Phone *')
  })

  it('names the country select', async () => {
    await render(<PhoneInput label="Phone" />)
    await expect.element(page.getByRole('combobox', { name: 'Country' })).toBeInTheDocument()
  })

  it('takes a custom name for the country select', async () => {
    await render(<PhoneInput label="Phone" countryLabel="Calling code" />)
    await expect.element(page.getByRole('combobox', { name: 'Calling code' })).toBeInTheDocument()
  })

  it('wires invalid state to aria-invalid and data-invalid', async () => {
    const { container } = await render(
      <>
        <PhoneInput label="Phone" invalid aria-describedby="err" />
        <p id="err">That number is not reachable</p>
      </>,
    )
    const box = container.querySelector('[data-rx-phone-input]')!
    expect(box).toHaveAttribute('aria-invalid', 'true')
    expect(box).toHaveAttribute('aria-describedby', 'err')
    expect(container.querySelector('[data-rx-phone-root]')).toHaveAttribute('data-invalid')
  })

  it('stays an exposed, disabled field rather than disappearing', async () => {
    const { container } = await render(<PhoneInput label="Phone" disabled />)
    expect(container.querySelector('[data-rx-phone-input]')).toBeDisabled()
    expect(page.getByRole('combobox').elements()).toHaveLength(1)
  })

  it('is fully operable from the keyboard', async () => {
    const { container } = await render(<PhoneInput label="Phone" countries={['US', 'GB']} />)
    const select = container.querySelector<HTMLSelectElement>('[data-rx-phone-country]')!
    select.focus()
    await userEvent.tab()
    expect(document.activeElement).toBe(container.querySelector('[data-rx-phone-input]'))
  })

  it('does not put the hidden value field in the tab order', async () => {
    const { container } = await render(<PhoneInput label="Phone" name="phone" />)
    const hidden = container.querySelector<HTMLInputElement>('[data-rx-phone-value]')!
    expect(hidden.type).toBe('hidden')
  })
})

describe('axe', () => {
  it('is clean when empty', async () => {
    const { container } = await render(<PhoneInput label="Phone" name="phone" />)
    expect(await violations(container)).toEqual([])
  })

  it('is clean when filled', async () => {
    const { container } = await render(
      <PhoneInput label="Phone" name="phone" defaultValue="+14155552671" />,
    )
    expect(await violations(container)).toEqual([])
  })

  it('is clean in an invalid, described state', async () => {
    const { container } = await render(
      <>
        <PhoneInput label="Phone" name="phone" invalid aria-describedby="err" />
        <p id="err">That number is not reachable</p>
      </>,
    )
    expect(await violations(container)).toEqual([])
  })

  it('is clean while disabled', async () => {
    const { container } = await render(<PhoneInput label="Phone" name="phone" disabled />)
    expect(await violations(container)).toEqual([])
  })

  it('is clean without the country select', async () => {
    const { container } = await render(
      <PhoneInput label="Phone" name="phone" hideCountrySelect defaultValue="+442071234567" />,
    )
    expect(await violations(container)).toEqual([])
  })

  it('is clean with the full country list rendered', async () => {
    // 234 options with emoji flags in them — the case most likely to trip a
    // colour-contrast or name rule if the option text were built badly.
    const { container } = await render(<PhoneInput label="Phone" name="phone" locale="en" />)
    expect(await violations(container)).toEqual([])
  })
})
