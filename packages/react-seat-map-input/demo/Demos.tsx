import { useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { SeatMap, findBestSeats, parseLayout } from '@rxova/react-seat-map-input'
import type { SeatMapRejection, SeatMapSection } from '@rxova/react-seat-map-input'
import { Section } from '@rxova/demo-kit'

/**
 * Every scenario the E2E suite drives, and the manual QA surface.
 *
 * Each block carries a `data-testid` so specs target intent rather than DOM
 * shape. Anything added here should be something worth checking in a real
 * page: full-page tab order, a genuine form round-trip, page-level RTL, and —
 * for this component especially — arrowing across a cabin with the mouse
 * unplugged.
 */

const CABIN = parseLayout(`
  Main cabin
  10: ###_###
  11: ##x_x##
  12: ###_#x#
  13: #x#_###
  14: ..._...
  15: ###_###
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

const SHORT_ROW = parseLayout(`
  12: ###_###
`)

function InteractiveDemo() {
  const [seats, setSeats] = useState<string[]>([])
  const [rejection, setRejection] = useState<SeatMapRejection | null>(null)

  return (
    <>
      <SeatMap
        sections={CABIN}
        value={seats}
        onChange={setSeats}
        onReject={setRejection}
        label="Choose your seats"
        maxSeats={4}
      />
      <p>
        chosen: <output data-testid="interactive-value">{seats.join(' ') || 'none'}</output> ·
        refused: <output data-testid="interactive-reject">{rejection?.reason ?? 'none'}</output>
      </p>
    </>
  )
}

function SectionsDemo() {
  const [seats, setSeats] = useState<string[]>([])
  return (
    <>
      <SeatMap sections={THEATRE} value={seats} onChange={setSeats} label="Choose your seats" />
      <p>
        chosen: <output data-testid="sections-value">{seats.join(' ') || 'none'}</output>
      </p>
    </>
  )
}

function RulesDemo() {
  const [seats, setSeats] = useState<string[]>([])
  const [rejection, setRejection] = useState<SeatMapRejection | null>(null)

  return (
    <>
      <SeatMap
        sections={SHORT_ROW}
        value={seats}
        onChange={setSeats}
        onReject={setRejection}
        label="Seats together"
        contiguous
        noOrphanSeats
        maxSeats={3}
      />
      <p>
        chosen: <output data-testid="rules-value">{seats.join(' ') || 'none'}</output> · refused:{' '}
        <output data-testid="rules-reject">{rejection?.message ?? 'none'}</output>
      </p>
      <button
        type="button"
        data-testid="rules-best"
        onClick={() => {
          setSeats(findBestSeats(SHORT_ROW, 2).map((seat) => seat.id))
        }}
      >
        Find 2 together
      </button>
    </>
  )
}

function NativeFormDemo() {
  const [submitted, setSubmitted] = useState<string | null>(null)
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const data = new FormData(e.currentTarget)
        setSubmitted(data.getAll('seats').map(String).join(' '))
      }}
    >
      <SeatMap
        sections={SHORT_ROW}
        name="seats"
        defaultValue={[]}
        onChange={() => undefined}
        label="Seats"
        minSeats={2}
      />
      <button type="submit">Submit</button>
      <output data-testid="native-form-result">{submitted ?? 'not submitted'}</output>
    </form>
  )
}

function HookFormDemo() {
  const { control, handleSubmit } = useForm<{ seats: string[] }>({ defaultValues: { seats: [] } })
  const [result, setResult] = useState<string | null>(null)

  return (
    <form
      onSubmit={(e) => {
        void handleSubmit((values) => {
          setResult(values.seats.join(' '))
        })(e)
      }}
    >
      <Controller
        name="seats"
        control={control}
        render={({ field }) => (
          <SeatMap
            sections={SHORT_ROW}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            label="Seats"
          />
        )}
      />
      <button type="submit">Submit</button>
      <output data-testid="hook-form-result">{result ?? 'not submitted'}</output>
    </form>
  )
}

function ScrollingDemo() {
  const sections = useMemo<SeatMapSection[]>(
    () => [
      {
        id: 'stadium',
        label: 'North stand',
        rows: Array.from({ length: 24 }, (_, row) => ({
          label: String(row + 1),
          cells: Array.from({ length: 20 }, (_, column) => ({
            id: `${String(row + 1)}-${String(column + 1)}`,
            status: (row + column) % 7 === 0 ? ('occupied' as const) : ('available' as const),
          })),
        })),
      },
    ],
    [],
  )
  const [seats, setSeats] = useState<string[]>([])

  return (
    <div
      data-testid="scroller"
      style={{ maxHeight: 180, maxWidth: 320, overflow: 'auto', border: '1px solid #ccc' }}
    >
      <SeatMap sections={sections} value={seats} onChange={setSeats} label="North stand" />
    </div>
  )
}

export function SeatMapDemos({ dir = 'ltr' }: { dir?: 'ltr' | 'rtl' }) {
  return (
    <main dir={dir}>
      <Section id="interactive" title="Interactive" note="Capped at four seats.">
        <InteractiveDemo />
      </Section>

      <Section id="sections" title="Sections" note="Stalls and circle, one grid each.">
        <SectionsDemo />
      </Section>

      <Section id="rules" title="Rules" note="Contiguous, no orphan seats, at most three.">
        <RulesDemo />
      </Section>

      <Section id="read-only" title="Read-only" note="A diagram, still keyboard navigable.">
        <SeatMap sections={SHORT_ROW} value={['12B', '12C']} label="Your seats" />
      </Section>

      <Section id="disabled" title="Disabled">
        <SeatMap
          sections={SHORT_ROW}
          defaultValue={['12A']}
          onChange={() => undefined}
          label="Seats"
          disabled
        />
      </Section>

      <Section id="invalid" title="Invalid" note="Described by an error message.">
        <SeatMap
          sections={SHORT_ROW}
          defaultValue={[]}
          onChange={() => undefined}
          label="Seats"
          invalid
          aria-describedby="seat-error"
        />
        <p id="seat-error">Choose at least one seat.</p>
      </Section>

      <Section id="native-form" title="Native form" note="Posts a real array under one name.">
        <NativeFormDemo />
      </Section>

      <Section id="hook-form" title="React Hook Form">
        <HookFormDemo />
      </Section>

      <Section id="scrolling" title="Scrolling" note="Focus follows the keyboard into view.">
        <ScrollingDemo />
      </Section>
    </main>
  )
}

export default SeatMapDemos
