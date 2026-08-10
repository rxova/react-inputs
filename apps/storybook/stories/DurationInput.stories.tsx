import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { DurationInput, toSeconds } from '@rxova/react-duration-input'

const meta = {
  title: 'Components/Duration input',
  component: DurationInput,
  args: {
    label: 'Length',
    minuteStep: 1,
    emitOutOfRange: true,
    disabled: false,
    readOnly: false,
    invalid: false,
    required: false,
    onChange: fn(),
    onPartsChange: fn(),
  },
  argTypes: {
    locale: {
      control: 'select',
      options: ['en-US', 'en-GB', 'de-DE', 'ja-JP', 'fr-FR', 'ar-EG'],
    },
    units: {
      control: 'select',
      options: [
        ['hour', 'minute'],
        ['minute'],
        ['minute', 'second'],
        ['day', 'hour'],
        ['day', 'hour', 'minute', 'second'],
      ],
    },
    minuteStep: { control: 'select', options: [1, 5, 10, 15, 30] },
    secondStep: { control: 'select', options: [1, 5, 10, 15, 30] },
    value: { control: false },
    // Objects, functions and nodes have no useful control representation.
    placeholders: { control: false },
    unitLabels: { control: false },
    renderSegment: { control: false },
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
} satisfies Meta<typeof DurationInput>

export default meta
type Story = StoryObj<typeof meta>

/** Every prop is live in the Controls panel; the spies log to Actions. */
export const Playground: Story = {}

/**
 * Any subset of the four units, largest first. The array is sorted and deduped,
 * so `['minute', 'hour']` renders as hours then minutes.
 */
export const Units: Story = {
  render: function Units(args) {
    return (
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        <DurationInput {...args} label="Cooking time" units={['hour', 'minute']} />
        <DurationInput {...args} label="Video position" units={['minute', 'second']} />
        <DurationInput {...args} label="Lead time" units={['day', 'hour']} />
        <DurationInput {...args} label="Timeout" units={['second']} />
      </div>
    )
  },
}

/**
 * The largest unit on screen has no ceiling: in a minutes-only field, `180` is
 * three hours and that is exactly what someone means.
 */
export const UnboundedLeadingUnit: Story = {
  args: { units: ['minute'], defaultValue: 'PT180M', label: 'Minutes only' },
}

/**
 * Type `90` into the minutes and Tab away: overflow carries upward, so it
 * settles into `1h 30m` rather than being refused at the keystroke.
 */
export const OverflowCarries: Story = {
  args: { units: ['hour', 'minute'], defaultValue: 'PT0S', label: 'Type 90 in the minutes' },
}

/**
 * The value is an ISO 8601 duration — and, unlike the date and time fields, it
 * does **not** sort as a string. `'PT10M' < 'PT2H'` is `true` and wrong, so
 * compare through `toSeconds` or `compareDurations`.
 */
export const CanonicalValueOut: Story = {
  render: function CanonicalValueOut(args) {
    const [value, setValue] = useState<string | null>('PT1H30M')
    return (
      <>
        <DurationInput {...args} value={value} onChange={setValue} />
        <output>
          value: <code>{value ?? 'null'}</code> — seconds:{' '}
          <code>{value === null ? 'null' : String(toSeconds(value))}</code>
        </output>
      </>
    )
  },
}

/** The unit suffixes and the segments' accessible names come from `Intl`. */
export const Locales: Story = {
  render: function Locales(args) {
    return (
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        {['en-GB', 'de-DE', 'fr-FR', 'ja-JP'].map((locale) => (
          <DurationInput
            {...args}
            key={locale}
            label={locale}
            locale={locale}
            defaultValue="PT2H5M"
          />
        ))}
      </div>
    )
  },
}

/**
 * `minuteStep` is the arrow-key increment, not a constraint on typing — it must
 * divide 60. Arrows clamp at each end rather than wrapping: a duration has no
 * cycle, so stepping down from `0m` must not become `59m`.
 */
export const SteppedMinutes: Story = {
  args: { minuteStep: 15, defaultValue: 'PT1H', label: 'Slot (15-minute steps)' },
}

/**
 * `min`/`max` bound the field, compared through seconds. `emitOutOfRange` still
 * reports a completed duration outside them, leaving it marked invalid rather
 * than discarding the input.
 */
export const WithRange: Story = {
  args: { min: 'PT15M', max: 'PT2H', defaultValue: 'PT30M', label: 'Session length' },
}

/** Per-unit placeholders and accessible names, for a localised field. */
export const CustomLabels: Story = {
  args: {
    placeholders: { hour: 'Std', minute: 'Min' },
    unitLabels: { hour: 'Stunden', minute: 'Minuten' },
    locale: 'de-DE',
  },
}

/** Disabled takes the segments out of the tab order; read-only leaves them in. */
export const States: Story = {
  render: function States(args) {
    return (
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        <DurationInput {...args} label="Disabled" disabled defaultValue="PT1H30M" />
        <DurationInput {...args} label="Read-only" readOnly defaultValue="PT1H30M" />
        <DurationInput {...args} label="Invalid" invalid defaultValue="PT1H30M" />
      </div>
    )
  },
}
