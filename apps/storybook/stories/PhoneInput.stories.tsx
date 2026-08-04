import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { PhoneInput, formatPhone, parsePhone } from '@rxova/react-phone-input'

const meta = {
  title: 'Components/Phone input',
  component: PhoneInput,
  args: {
    label: 'Phone number',
    defaultCountry: 'US',
    hideCountrySelect: false,
    showValidity: false,
    disabled: false,
    readOnly: false,
    invalid: false,
    required: false,
    onChange: fn(),
    onCountryChange: fn(),
  },
  argTypes: {
    defaultCountry: {
      control: 'select',
      options: ['US', 'GB', 'DE', 'BR', 'IN', 'JP', 'NG', 'AR'],
    },
    locale: {
      control: 'select',
      options: ['en-US', 'de-DE', 'fr-FR', 'ja-JP', 'ar-EG'],
    },
    value: { control: false },
    country: { control: false },
    countries: { control: false },
    // Functions and nodes have no useful control representation.
    renderCountry: { control: false },
    validityLabel: { control: false },
    onWarn: { control: false },
    style: { control: false },
  },
  decorators: [
    (Story) => (
      <div className="story">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PhoneInput>

export default meta
type Story = StoryObj<typeof meta>

/** Every prop is live in the Controls panel; the spies log to Actions. */
export const Playground: Story = {}

/**
 * The value is always E.164 in and out, never the formatted display text —
 * which changes with the country and would make the value a presentation
 * detail. This story shows both side by side.
 */
export const E164ValueOut: Story = {
  render: function E164ValueOut(args) {
    const [value, setValue] = useState('+14155552671')
    const parsed = parsePhone(value)
    return (
      <>
        <PhoneInput {...args} value={value} onChange={setValue} />
        <output>
          E.164: <code>{value || '(empty)'}</code>
          <br />
          national: <code>{formatPhone(parsed, false) || '(empty)'}</code>
          <br />
          possible: <code>{String(parsed.possible)}</code>
        </output>
      </>
    )
  },
}

/**
 * `countries` restricts the picker, in the order given. An empty array is
 * ignored — a picker with nothing in it is not a usable field.
 */
export const RestrictedCountryList: Story = {
  args: {
    countries: ['GB', 'IE', 'FR', 'DE'],
    defaultCountry: 'GB',
    label: 'European phone number',
  },
}

/** Country names come from `Intl`, so the picker follows `locale`. */
export const LocalisedCountryNames: Story = {
  args: { locale: 'de-DE', defaultCountry: 'DE', countryLabel: 'Land' },
}

/**
 * `showValidity` reports, after the field has been left, whether the digits are
 * a length the selected country actually uses. It reflects *possible*, not full
 * validity: it catches a typo'd or half-typed number, not an unassigned one.
 */
export const WithValidityHint: Story = {
  args: { showValidity: true, defaultValue: '+1415555', label: 'Phone (blur to check)' },
}

/**
 * Without the picker, numbers must be typed in `+…` form and the country is
 * inferred from the dial code.
 */
export const WithoutCountrySelect: Story = {
  args: { hideCountrySelect: true, defaultValue: '+442071838750', placeholder: '+44 …' },
}

/** `renderCountry` draws the option contents — flag, name and calling code by default. */
export const CustomCountryOption: Story = {
  args: {
    countries: ['US', 'GB', 'DE'],
    renderCountry: ({ country }) => `${country.iso2} +${country.dial}`,
  },
}

/** `invalid` sets `aria-invalid` and `data-invalid`; the ring is a consumer token. */
export const Invalid: Story = {
  render: (args) => (
    <>
      <PhoneInput {...args} invalid aria-describedby="phone-invalid-help" />
      <p id="phone-invalid-help" className="error">
        We could not reach that number
      </p>
    </>
  ),
  args: { defaultValue: '+14155552671' },
}

/** Disabled: exposed to assistive tech, not editable. */
export const Disabled: Story = {
  args: { disabled: true, defaultValue: '+14155552671' },
}

/** Read-only: the value is shown and focusable, but not editable. */
export const ReadOnly: Story = {
  args: { readOnly: true, defaultValue: '+14155552671' },
}

/**
 * With `name` set the component emits a hidden input carrying the E.164 value,
 * so a native `<form>` posts it. Submit to see the `FormData` payload.
 */
export const InAForm: Story = {
  render: function InAForm(args) {
    const [submitted, setSubmitted] = useState<string | null>(null)
    return (
      <form
        className="story"
        onSubmit={(e) => {
          e.preventDefault()
          setSubmitted(JSON.stringify(Object.fromEntries(new FormData(e.currentTarget))))
        }}
      >
        <PhoneInput {...args} name="phone" />
        <button type="submit">Submit</button>
        <output>{submitted ?? 'not submitted'}</output>
      </form>
    )
  },
}
