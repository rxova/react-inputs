import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { MeasurementInput, toBaseUnit } from '@rxova/react-measurement-input'

const meta = {
  title: 'Components/Measurement input',
  component: MeasurementInput,
  args: {
    label: 'Height',
    precision: 0,
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
        ['meter', 'centimeter'],
        ['foot', 'inch'],
        ['stone', 'pound'],
        ['kilogram', 'gram'],
        ['gallon', 'fluid-ounce'],
        ['celsius'],
      ],
    },
    precision: { control: 'select', options: [0, 1, 2, 3] },
    step: { control: 'select', options: [0.1, 0.5, 1, 5, 50] },
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
} satisfies Meta<typeof MeasurementInput>

export default meta
type Story = StoryObj<typeof meta>

/** Every prop is live in the Controls panel; the spies log to Actions. */
export const Playground: Story = {}

/**
 * Any units of one dimension whose adjacent pairs divide exactly. The array is
 * sorted largest-first and deduped, so `['inch', 'foot']` renders as feet then
 * inches.
 */
export const Units: Story = {
  render: function Units(args) {
    return (
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        <MeasurementInput {...args} label="Height" units={['foot', 'inch']} />
        <MeasurementInput {...args} label="Height, metric" units={['meter', 'centimeter']} />
        <MeasurementInput {...args} label="Weight" units={['stone', 'pound']} />
        <MeasurementInput {...args} label="Parcel" units={['kilogram', 'gram']} />
        <MeasurementInput {...args} label="Fuel" units={['gallon', 'fluid-ounce']} />
      </div>
    )
  },
}

/**
 * The largest unit on screen has no ceiling: in a centimetres-only field, `180`
 * is a height and that is exactly what someone means.
 */
export const UnboundedLeadingUnit: Story = {
  args: { units: ['centimeter'], defaultValue: '180 centimeter', label: 'Centimetres only' },
}

/**
 * Type `14` into the inches and Tab away: overflow carries upward, so it settles
 * into `1 ft 2 in` rather than being refused at the keystroke.
 */
export const OverflowCarries: Story = {
  args: { units: ['foot', 'inch'], label: 'Type 14 in the inches' },
}

/**
 * A pair of units has to divide exactly. A metre is 39.37 inches, so an inches
 * segment beside a metres one would have no ceiling to carry at — the pair
 * collapses to a single segment with a `units-ratio-not-integer` warning.
 */
export const RefusedUnitPair: Story = {
  args: {
    units: ['meter', 'inch'],
    label: 'Asked for metres and inches',
    onWarn: fn(),
  },
}

/**
 * Temperature is an offset scale, not a ratio: °C → °F is `× 9/5 + 32`. It is
 * single-unit by construction, signed, and the one dimension with no floor.
 */
export const Temperature: Story = {
  args: {
    units: ['celsius'],
    precision: 1,
    step: 0.1,
    defaultValue: '36.6 celsius',
    label: 'Body temperature',
  },
}

/**
 * The value is `"<amount> <unit>"` in the smallest unit on screen — and, unlike
 * a plain number, it carries its own units contract. Two equal measurements are
 * not `===` equal, so compare through `toBaseUnit` or `compareMeasurements`.
 */
export const CanonicalValueOut: Story = {
  render: function CanonicalValueOut(args) {
    const [value, setValue] = useState<string | null>('71 inch')
    return (
      <>
        <MeasurementInput {...args} units={['foot', 'inch']} value={value} onChange={setValue} />
        <output>
          value: <code>{value ?? 'null'}</code> — metres:{' '}
          <code>{value === null ? 'null' : String(toBaseUnit(value))}</code>
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
          <MeasurementInput
            {...args}
            key={locale}
            label={locale}
            locale={locale}
            units={['foot', 'inch']}
            defaultValue="71 inch"
          />
        ))}
      </div>
    )
  },
}

/**
 * `step` is the arrow-key increment for the smallest segment, not a constraint
 * on typing. Arrows clamp at each end rather than wrapping: a measurement has no
 * cycle, so stepping down from `0 g` must not become `999 g`.
 */
export const SteppedGrams: Story = {
  args: {
    units: ['kilogram', 'gram'],
    step: 50,
    defaultValue: '1500 gram',
    label: 'Parcel weight (50 g steps)',
  },
}

/**
 * `min`/`max` bound the field and may be written in any unit of the dimension.
 * `emitOutOfRange` still reports a completed measurement outside them, leaving
 * it marked invalid rather than discarding the input.
 */
export const WithRange: Story = {
  args: {
    units: ['foot', 'inch'],
    min: '1.4 meter',
    max: '2.1 meter',
    defaultValue: '36 inch',
    label: 'Adult height',
    onWarn: fn(),
  },
}

/** Per-unit placeholders and accessible names, for a localised field. */
export const CustomLabels: Story = {
  args: {
    units: ['meter', 'centimeter'],
    placeholders: { meter: 'm', centimeter: 'cm' },
    unitLabels: { meter: 'Meter', centimeter: 'Zentimeter' },
    locale: 'de-DE',
  },
}

/** Disabled takes the segments out of the tab order; read-only leaves them in. */
export const States: Story = {
  render: function States(args) {
    return (
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        <MeasurementInput {...args} label="Disabled" disabled defaultValue="180 centimeter" />
        <MeasurementInput {...args} label="Read-only" readOnly defaultValue="180 centimeter" />
        <MeasurementInput {...args} label="Invalid" invalid defaultValue="180 centimeter" />
      </div>
    )
  },
}
