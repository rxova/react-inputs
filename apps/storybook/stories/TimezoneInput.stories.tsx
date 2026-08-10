import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { TimezoneInput, localZone, zoneOffsetLabel } from '@rxova/react-timezone-input'

const meta = {
  title: 'Components/Time zone input',
  component: TimezoneInput,
  args: {
    label: 'Time zone',
    grouped: true,
    disabled: false,
    invalid: false,
    required: false,
    onChange: fn(),
  },
  argTypes: {
    locale: {
      control: 'select',
      options: ['en-US', 'en-GB', 'de-DE', 'es-ES', 'ja-JP', 'ar-EG'],
    },
    grouped: { control: 'boolean' },
    allowEmpty: { control: 'boolean' },
    placeholder: { control: 'text' },
    value: { control: false },
    // Arrays, dates, functions and nodes have no useful control representation.
    zones: { control: false },
    referenceDate: { control: false },
    renderZone: { control: false },
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
} satisfies Meta<typeof TimezoneInput>

export default meta
type Story = StoryObj<typeof meta>

/** Every prop is live in the Controls panel; the spy logs to Actions. */
export const Playground: Story = {}

/**
 * `Intl.supportedValuesOf('timeZone')` does not contain `UTC`, and nothing in it
 * stands in for it — so a picker built straight off that array cannot select the
 * most commonly stored zone in the world. This one adds it, first in the list.
 */
export const UtcIsSelectable: Story = {
  args: { defaultValue: 'UTC' },
}

/**
 * The value is an IANA id, never an offset: `-05:00` is New York in winter and
 * nothing in particular in summer. The offset is derived beside it.
 */
export const CanonicalValueOut: Story = {
  render: function CanonicalValueOut(args) {
    const [value, setValue] = useState<string | null>('Europe/Madrid')
    return (
      <>
        <TimezoneInput {...args} value={value} onChange={setValue} />
        <output>
          value: <code>{value ?? 'null'}</code> — offset now:{' '}
          <code>{value ? (zoneOffsetLabel(value) ?? '—') : '—'}</code>
        </output>
      </>
    )
  },
}

/** A shortlist. Unusable ids are dropped with a warning; `UTC` stays available. */
export const NarrowedList: Story = {
  args: {
    label: 'Office',
    zones: ['Europe/Madrid', 'America/New_York', 'Asia/Tokyo'],
    defaultValue: 'Europe/Madrid',
  },
}

/**
 * An offset is a fact about an instant, not a property of a zone. The same four
 * zones relabel when the reference date crosses a DST boundary — while their
 * *names* stay put, because the labels use `longGeneric`.
 */
export const ReferenceDate: Story = {
  render: function ReferenceDate(args) {
    const [summer, setSummer] = useState(false)
    return (
      <>
        <TimezoneInput
          {...args}
          key={summer ? 'jul' : 'jan'}
          zones={['Europe/Madrid', 'America/New_York', 'Australia/Sydney', 'Asia/Kathmandu']}
          referenceDate={new Date(summer ? '2026-07-15T12:00:00Z' : '2026-01-15T12:00:00Z')}
          defaultValue="Australia/Sydney"
        />
        <button
          type="button"
          onClick={() => {
            setSummer((on) => !on)
          }}
        >
          {summer ? 'July' : 'January'} — toggle season
        </button>
      </>
    )
  },
}

/** A "use my zone" affordance, from the runtime's own `Intl` answer. */
export const LocalZone: Story = {
  render: function LocalZone(args) {
    const [value, setValue] = useState<string | null>(null)
    return (
      <>
        <TimezoneInput {...args} value={value} onChange={setValue} />
        <button
          type="button"
          onClick={() => {
            setValue(localZone())
          }}
        >
          Use my zone
        </button>
      </>
    )
  },
}

/** Zone names follow the locale. It changes no id and no offset. */
export const Localised: Story = {
  args: { locale: 'es-ES', label: 'Zona horaria', defaultValue: 'Europe/Madrid' },
}

/** Ungrouped: one flat list of 419 options, no `<optgroup>`. */
export const Flat: Story = {
  args: { grouped: false },
}

/**
 * `renderZone` replaces an option's text. It returns a string because an
 * `<option>` may contain text and nothing else — a constraint of the element,
 * not of this component.
 */
export const CustomOptionText: Story = {
  args: {
    zones: ['Europe/Madrid', 'America/New_York', 'Asia/Tokyo'],
    renderZone: ({ city, offset }) => `${city} ${offset ?? ''}`.trim(),
  },
}

/** `invalid` sets `aria-invalid` and `data-invalid`; the styling is a consumer token. */
export const Invalid: Story = {
  render: (args) => (
    <>
      <TimezoneInput {...args} invalid aria-describedby="timezone-invalid-help" />
      <p id="timezone-invalid-help" className="error">
        We do not schedule in that zone
      </p>
    </>
  ),
  args: { defaultValue: 'Pacific/Kiritimati' },
}

/** Disabled: exposed to assistive tech, not editable. */
export const Disabled: Story = {
  args: { disabled: true, defaultValue: 'Europe/Madrid' },
}

/**
 * With `name` set the `<select>` carries it, so a native `<form>` posts the id
 * with no hidden input anywhere. Submit to see the `FormData` payload.
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
        <TimezoneInput {...args} name="zone" defaultValue="Europe/Madrid" />
        <button type="submit">Submit</button>
        <output>{submitted ?? 'not submitted'}</output>
      </form>
    )
  },
}
