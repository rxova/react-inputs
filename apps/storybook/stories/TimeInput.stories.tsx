import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { TimeInput } from '@rxova/react-time-input'

const meta = {
  title: 'Components/Time input',
  component: TimeInput,
  args: {
    label: 'Start time',
    showSeconds: false,
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
      options: ['en-US', 'en-GB', 'de-DE', 'ja-JP', 'ar-EG'],
    },
    hour12: { control: 'boolean' },
    minuteStep: { control: 'select', options: [1, 5, 10, 15, 30] },
    secondStep: { control: 'select', options: [1, 5, 10, 15, 30] },
    value: { control: false },
    // Objects, functions and nodes have no useful control representation.
    placeholders: { control: false },
    segmentLabels: { control: false },
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
} satisfies Meta<typeof TimeInput>

export default meta
type Story = StoryObj<typeof meta>

/** Every prop is live in the Controls panel; the spies log to Actions. */
export const Playground: Story = {}

/**
 * The clock follows the locale by default — `en-US` shows AM/PM, `de-DE` a
 * 24-hour field. The value stays 24-hour either way.
 */
export const TwelveHourClock: Story = {
  args: { locale: 'en-US', hour12: true, defaultValue: '14:30', label: 'Meeting time' },
}

/** `hour12: false` forces the 24-hour field whatever the locale would pick. */
export const TwentyFourHourClock: Story = {
  args: { locale: 'en-US', hour12: false, defaultValue: '14:30' },
}

/**
 * The value is always `HH:mm[:ss]`, 24-hour, whatever the field displays: one
 * canonical format means it can be stored, compared and sorted without knowing
 * which locale produced it.
 */
export const CanonicalValueOut: Story = {
  render: function CanonicalValueOut(args) {
    const [value, setValue] = useState<string | null>('14:30')
    return (
      <>
        <TimeInput {...args} hour12 value={value} onChange={setValue} />
        <output>
          value: <code>{value ?? 'null'}</code>
        </output>
      </>
    )
  },
}

/** A seconds segment, with its own arrow-key step. */
export const WithSeconds: Story = {
  args: { showSeconds: true, secondStep: 15, defaultValue: '09:05:30' },
}

/**
 * `minuteStep` is the arrow-key increment, not a constraint on typing — it must
 * divide 60. Useful for booking grids.
 */
export const SteppedMinutes: Story = {
  args: { minuteStep: 15, defaultValue: '09:00', label: 'Slot (15-minute steps)' },
}

/**
 * `min`/`max` bound the field. `emitOutOfRange` still reports a completed time
 * outside them, leaving it marked invalid rather than discarding the input.
 */
export const WithRange: Story = {
  args: {
    min: '09:00',
    max: '17:00',
    defaultValue: '10:30',
    label: 'Office hours only',
  },
}

/** Per-segment placeholders and accessible names, for a localised field. */
export const CustomSegmentLabels: Story = {
  args: {
    locale: 'de-DE',
    label: 'Uhrzeit',
    placeholders: { hour: 'SS', minute: 'MM' },
    segmentLabels: { hour: 'Stunde', minute: 'Minute' },
  },
}

/** `invalid` sets `aria-invalid` and `data-invalid`; the ring is a consumer token. */
export const Invalid: Story = {
  render: (args) => (
    <>
      <TimeInput {...args} invalid aria-describedby="time-invalid-help" />
      <p id="time-invalid-help" className="error">
        We are closed at that time
      </p>
    </>
  ),
  args: { defaultValue: '03:00' },
}

/** Disabled: exposed to assistive tech, not editable. */
export const Disabled: Story = {
  args: { disabled: true, defaultValue: '14:30' },
}

/** Read-only: the value is shown and focusable, but not editable. */
export const ReadOnly: Story = {
  args: { readOnly: true, defaultValue: '14:30' },
}

/**
 * With `name` set the component emits a hidden input carrying the 24-hour
 * value, so a native `<form>` posts it. Submit to see the `FormData` payload.
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
        <TimeInput {...args} name="time" />
        <button type="submit">Submit</button>
        <output>{submitted ?? 'not submitted'}</output>
      </form>
    )
  },
}
