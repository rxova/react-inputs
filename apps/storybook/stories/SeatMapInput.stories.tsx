import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useArgs } from 'storybook/preview-api'
import { fn } from 'storybook/test'
import { SeatMap, findBestSeats, parseLayout } from '@rxova/react-seat-map-input'
import type { SeatMapRejection } from '@rxova/react-seat-map-input'

const CABIN = parseLayout(`
  Main cabin
  10: ###_###
  11: ##x_x##
  12: ###_#x#
  13: #x#_###
  14: ###_###
`)

const THEATRE = parseLayout(`
  Stalls
  A: ####_####
  B: ###x_x###
  C: ####_####
  Circle
  A: ###_###
  B: ##x_###
`)

const ROW = parseLayout('12: ######')

const meta = {
  title: 'Components/Seat map input',
  component: SeatMap,
  args: {
    sections: CABIN,
    label: 'Choose your seats',
    maxSeats: 4,
    contiguous: false,
    noOrphanSeats: false,
    disabled: false,
    invalid: false,
    pageSize: 5,
    onChange: fn(),
    onReject: fn(),
    onHoverChange: fn(),
  },
  argTypes: {
    maxSeats: { control: { type: 'number', min: 1, max: 10, step: 1 } },
    minSeats: { control: { type: 'number', min: 0, max: 10, step: 1 } },
    pageSize: { control: { type: 'number', min: 1, max: 20, step: 1 } },
    dir: { control: 'inline-radio', options: ['ltr', 'rtl'] },
    // Layouts, functions and nodes have no useful control representation.
    sections: { control: false },
    rows: { control: false },
    isSelectable: { control: false },
    renderSeat: { control: false },
    formatSeatLabel: { control: false },
    formatAnnouncement: { control: false },
    formatValidationMessage: { control: false },
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
} satisfies Meta<typeof SeatMap>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Fully controlled and wired back into the Controls panel. Tab into the grid
 * once, then walk the whole cabin with the arrow keys — sold seats included,
 * which is the point: they are `aria-disabled`, never `disabled`.
 */
export const Playground: Story = {
  render: function Playground(args) {
    const [, updateArgs] = useArgs()
    return (
      <SeatMap
        {...args}
        onChange={(ids, seats) => {
          args.onChange?.(ids, seats)
          updateArgs({ value: ids })
        }}
      />
    )
  },
}

/** Each section is its own ARIA grid, with its own single tab stop. */
export const Sections: Story = {
  args: { sections: THEATRE, maxSeats: 6 },
  render: function Sections(args) {
    const [value, setValue] = useState<string[]>([])
    return <SeatMap {...args} value={value} onChange={setValue} />
  },
}

/**
 * `contiguous` keeps the party together and `noOrphanSeats` stops a booking
 * stranding a lone seat. Every refusal reaches `onReject` *and* the live region.
 */
export const Rules: Story = {
  args: { sections: ROW, contiguous: true, noOrphanSeats: true, maxSeats: 3 },
  render: function Rules(args) {
    const [value, setValue] = useState<string[]>([])
    const [rejection, setRejection] = useState<SeatMapRejection | null>(null)
    return (
      <div className="row">
        <SeatMap
          {...args}
          value={value}
          onChange={setValue}
          onReject={(next) => {
            args.onReject?.(next)
            setRejection(next)
          }}
        />
        <span className="readout">{rejection?.message ?? 'Pick three together.'}</span>
      </div>
    )
  },
}

/** `findBestSeats` scans for the best run of adjacent free seats. */
export const FindSeatsTogether: Story = {
  args: { sections: CABIN, maxSeats: 3 },
  render: function FindSeatsTogether(args) {
    const [value, setValue] = useState<string[]>([])
    return (
      <div className="row">
        <SeatMap {...args} value={value} onChange={setValue} />
        <button
          type="button"
          onClick={() => {
            setValue(findBestSeats(CABIN, 3).map((seat) => seat.id))
          }}
        >
          Find 3 together
        </button>
      </div>
    )
  },
}

/**
 * Without `onChange` the map is a read-only diagram — still a navigable grid,
 * but stating selection with `aria-selected` rather than a checkbox nobody can
 * tick.
 */
export const ReadOnly: Story = {
  args: { sections: CABIN, value: ['11A', '11B'], onChange: undefined, label: 'Your seats' },
}

/** Every visual is a CSS custom property; there is no stylesheet to import. */
export const Themed: Story = {
  args: { sections: CABIN },
  render: function Themed(args) {
    const [value, setValue] = useState<string[]>(['10C'])
    return (
      <SeatMap
        {...args}
        value={value}
        onChange={setValue}
        style={
          {
            '--rx-seat-map-seat-size': '2rem',
            '--rx-seat-map-radius': '0.6rem',
            '--rx-seat-map-bg-selected': '#0f766e',
            '--rx-seat-map-color-selected': '#ffffff',
            '--rx-seat-map-bg-occupied': '#e5e5e5',
          } as React.CSSProperties
        }
      />
    )
  },
}

/** Disabled: exposed to assistive tech as a disabled field, not interactive. */
export const Disabled: Story = {
  args: { disabled: true, value: ['10A'] },
}

/**
 * Each seat is a native checkbox under one `name`, so a form posts a real
 * array. `minSeats` sets a native validation message rather than blocking the
 * pick. Submit with fewer than two seats to see the browser refuse.
 */
export const InAForm: Story = {
  args: { sections: ROW, minSeats: 2 },
  render: function InAForm(args) {
    const [value, setValue] = useState<string[]>([])
    const [submitted, setSubmitted] = useState<string | null>(null)
    return (
      <form
        className="story"
        onSubmit={(e) => {
          e.preventDefault()
          setSubmitted(new FormData(e.currentTarget).getAll('seats').map(String).join(' '))
        }}
      >
        <SeatMap {...args} name="seats" value={value} onChange={setValue} label="Seats" />
        <button type="submit">Submit</button>
        <output>{submitted ?? 'not submitted'}</output>
      </form>
    )
  },
}
