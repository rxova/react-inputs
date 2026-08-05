import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useArgs } from 'storybook/preview-api'
import { fn } from 'storybook/test'
import { Rating } from '@rxova/react-rating-input'
import type { RatingIconState } from '@rxova/react-rating-input'

const meta = {
  title: 'Components/Rating input',
  component: Rating,
  args: {
    value: 3,
    max: 5,
    precision: 1,
    rounding: 'nearest',
    label: 'Rate this',
    disabled: false,
    invalid: false,
    onChange: fn(),
    onHoverChange: fn(),
  },
  argTypes: {
    rounding: { control: 'select', options: ['nearest', 'down', 'up', 'none'] },
    precision: { control: 'select', options: [0, 0.25, 0.5, 1] },
    max: { control: { type: 'number', min: 1, max: 10, step: 1 } },
    value: { control: { type: 'number', min: 0, step: 0.1 } },
    // Functions and nodes have no useful control representation.
    icon: { control: false },
    emptyIcon: { control: false },
    formatLabel: { control: false },
    formatOptionLabel: { control: false },
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
} satisfies Meta<typeof Rating>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Fully controlled and wired back into the Controls panel: click an icon and
 * the `value` control updates; drag the control and the component follows.
 */
export const Playground: Story = {
  render: function Playground(args) {
    const [, updateArgs] = useArgs()
    return (
      <Rating
        {...args}
        onChange={(value) => {
          args.onChange?.(value)
          updateArgs({ value })
        }}
      />
    )
  },
}

/** `precision={0.5}` snaps hover, keyboard and clicks onto half-icon steps. */
export const HalfSteps: Story = {
  render: function HalfSteps(args) {
    const [value, setValue] = useState(2.5)
    return <Rating {...args} value={value} precision={0.5} onChange={setValue} />
  },
}

/**
 * Without `onChange` the component is a read-only display, and the default
 * `precision={0}` paints the exact fraction — an average score, unrounded.
 */
export const ReadOnlyAverage: Story = {
  args: { value: 3.7, precision: 0, onChange: undefined },
  render: (args) => (
    <div className="row">
      <Rating {...args} label="Average rating" />
      <span className="readout">3.7 out of 5</span>
    </div>
  ),
}

/**
 * Both icons accept a render function receiving per-icon state — here hearts
 * that dim when empty and scale up under the hover/keyboard preview.
 */
export const CustomIcons: Story = {
  render: function CustomIcons(args) {
    const [value, setValue] = useState(3)
    const heart = (state: RatingIconState) => (
      <span
        style={{
          fontSize: 'var(--rx-rating-size)',
          display: 'inline-block',
          transform: state.active ? 'scale(1.2)' : 'none',
          transition: 'transform 120ms',
        }}
      >
        ♥
      </span>
    )
    return (
      <Rating
        {...args}
        value={value}
        onChange={setValue}
        icon={heart}
        emptyIcon={heart}
        label="Hearts"
        className="hearts"
      />
    )
  },
}

/** Any positive integer `max` works; the radios and labels scale with it. */
export const TenScale: Story = {
  args: { max: 10, value: 7 },
  // Wired like Playground: without writing the clicked value back into args,
  // the controlled `value: 7` would pin the rating to the seventh icon.
  render: function TenScale(args) {
    const [, updateArgs] = useArgs()
    return (
      <Rating
        {...args}
        onChange={(value) => {
          args.onChange?.(value)
          updateArgs({ value })
        }}
      />
    )
  },
}

/** Disabled: exposed to assistive tech, not interactive. */
export const Disabled: Story = {
  args: { disabled: true, value: 2 },
}

/**
 * Under the hood each option is a native radio, so with `name` set the value
 * posts through native form submission. Submit to see the payload.
 */
export const InAForm: Story = {
  render: function InAForm(args) {
    const [value, setValue] = useState(0)
    const [submitted, setSubmitted] = useState<string | null>(null)
    return (
      <form
        className="story"
        onSubmit={(e) => {
          e.preventDefault()
          setSubmitted(JSON.stringify(Object.fromEntries(new FormData(e.currentTarget))))
        }}
      >
        <Rating {...args} name="score" value={value} onChange={setValue} label="Score" />
        <button type="submit">Submit</button>
        <output>{submitted ?? 'not submitted'}</output>
      </form>
    )
  },
}
