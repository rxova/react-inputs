import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { DateInput } from '@rxova/react-date-input'

const meta = {
  title: 'Components/Date input',
  component: DateInput,
  args: {
    label: 'Date of birth',
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
      options: ['en-US', 'en-GB', 'de-DE', 'ja-JP', 'ar-EG', 'hu-HU'],
    },
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
} satisfies Meta<typeof DateInput>

export default meta
type Story = StoryObj<typeof meta>

/** Every prop is live in the Controls panel; the spies log to Actions. */
export const Playground: Story = {}

/**
 * Segment order, separators and month names all follow `locale` — `en-US` puts
 * the month first, `en-GB` the day, `ja-JP` the year. Nothing else changes.
 */
export const LocaleOrdering: Story = {
  args: { locale: 'ja-JP', defaultValue: '2026-08-04', label: '生年月日' },
}

/**
 * The value is `YYYY-MM-DD`, never a `Date`: a calendar date is not a point in
 * time, and the moment it becomes one it acquires a timezone that shifts it a
 * day west of UTC.
 */
export const IsoValueOut: Story = {
  render: function IsoValueOut(args) {
    const [value, setValue] = useState<string | null>('2026-08-04')
    return (
      <>
        <DateInput {...args} value={value} onChange={setValue} />
        <output>
          value: <code>{value ?? 'null'}</code>
        </output>
      </>
    )
  },
}

/**
 * `min`/`max` bound the field. `emitOutOfRange` still reports a completed date
 * outside them, leaving it marked invalid rather than silently discarding what
 * the user typed.
 */
export const WithRange: Story = {
  args: {
    min: '2026-01-01',
    max: '2026-12-31',
    label: 'A date in 2026',
    defaultValue: '2026-06-15',
  },
}

/** Per-segment placeholders and accessible names, for a localised field. */
export const CustomSegmentLabels: Story = {
  args: {
    locale: 'de-DE',
    label: 'Geburtsdatum',
    placeholders: { day: 'TT', month: 'MM', year: 'JJJJ' },
    segmentLabels: { day: 'Tag', month: 'Monat', year: 'Jahr' },
  },
}

/**
 * `onPartsChange` fires on every keystroke, including while the date is
 * incomplete — unlike `onChange`, which waits for a complete, valid date.
 */
export const PartialEntry: Story = {
  render: function PartialEntry(args) {
    const [parts, setParts] = useState('')
    const [committed, setCommitted] = useState<string | null>(null)
    return (
      <>
        <DateInput
          {...args}
          onPartsChange={(p) => {
            setParts(JSON.stringify(p))
          }}
          onChange={setCommitted}
        />
        <output>
          parts: <code>{parts || '(untouched)'}</code>
          <br />
          onChange: <code>{committed ?? 'null'}</code>
        </output>
      </>
    )
  },
}

/** `invalid` sets `aria-invalid` and `data-invalid`; the ring is a consumer token. */
export const Invalid: Story = {
  render: (args) => (
    <>
      <DateInput {...args} invalid aria-describedby="date-invalid-help" />
      <p id="date-invalid-help" className="error">
        That date is in the future
      </p>
    </>
  ),
  args: { defaultValue: '2030-01-01' },
}

/** Disabled: exposed to assistive tech, not editable. */
export const Disabled: Story = {
  args: { disabled: true, defaultValue: '2026-08-04' },
}

/** Read-only: the value is shown and focusable, but not editable. */
export const ReadOnly: Story = {
  args: { readOnly: true, defaultValue: '2026-08-04' },
}

/**
 * With `name` set the component emits a hidden input carrying the ISO value, so
 * a native `<form>` posts it. Submit to see the `FormData` payload.
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
        <DateInput {...args} name="date" />
        <button type="submit">Submit</button>
        <output>{submitted ?? 'not submitted'}</output>
      </form>
    )
  },
}
