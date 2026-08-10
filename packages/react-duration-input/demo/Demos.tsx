import { useState } from 'react'
import { Section } from '@rxova/demo-kit'
import { DurationInput, toSeconds } from '@rxova/react-duration-input'
import type { DurationWarning } from '@rxova/react-duration-input'

/**
 * The E2E target. Every section is something the Playwright suite drives, so
 * this doubles as the manual-QA page and as the page-level accessibility scan
 * subject — several problems (duplicate ids across instances, tab order across
 * a whole form) only exist in composition and cannot be caught by a component
 * test.
 */
export function DurationDemos() {
  const [value, setValue] = useState<string | null>('PT1H30M')
  const [ranged, setRanged] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<DurationWarning[]>([])
  const [submitted, setSubmitted] = useState<string | null>(null)

  return (
    <>
      <Section id="basic" title="Basic" note="Uncontrolled, hours and minutes.">
        <DurationInput label="How long" name="how-long" />
      </Section>

      <Section
        id="units"
        title="Units"
        note="Any subset of days, hours, minutes and seconds. The largest one on screen is unbounded."
      >
        <p data-testid="units-minutes">
          <DurationInput label="Minutes only" units={['minute']} defaultValue="PT90M" />
        </p>
        <p data-testid="units-hms">
          <DurationInput
            label="Hours, minutes, seconds"
            units={['hour', 'minute', 'second']}
            defaultValue="PT1H30M15S"
          />
        </p>
        <p data-testid="units-dhm">
          <DurationInput label="Days and hours" units={['day', 'hour']} defaultValue="P2DT4H" />
        </p>
      </Section>

      <Section
        id="locales"
        title="Locales"
        note="The suffixes and the segment names come from Intl, not from a bundled table."
      >
        <p data-testid="locale-en">
          <DurationInput label="English" locale="en-GB" defaultValue="PT2H5M" />
        </p>
        <p data-testid="locale-de">
          <DurationInput label="German" locale="de-DE" defaultValue="PT2H5M" />
        </p>
        <p data-testid="locale-ja">
          <DurationInput label="Japanese" locale="ja-JP" defaultValue="PT2H5M" />
        </p>
      </Section>

      <Section
        id="controlled"
        title="Controlled"
        note="The value is always an ISO 8601 duration. It does not sort as a string — use toSeconds."
      >
        <DurationInput label="Controlled duration" value={value} onChange={setValue} />
        <p data-testid="value">{value ?? 'null'}</p>
        <p data-testid="value-seconds">{value === null ? 'null' : String(toSeconds(value))}</p>
        <button
          type="button"
          onClick={() => {
            setValue('PT0S')
          }}
        >
          Zero
        </button>
        <button
          type="button"
          onClick={() => {
            setValue('PT45M')
          }}
        >
          45 minutes
        </button>
        <button
          type="button"
          onClick={() => {
            setValue(null)
          }}
        >
          Clear
        </button>
      </Section>

      <Section
        id="carry"
        title="Overflow carries"
        note="Type 90 into the minutes and leave the field: it settles to 1h 30m."
      >
        <DurationInput label="Carrying duration" name="carry" />
      </Section>

      <Section
        id="steps"
        title="Steps"
        note="Arrow keys walk a grid. They clamp at each end rather than wrapping — a duration has no cycle."
      >
        <DurationInput
          label="Meeting length"
          units={['hour', 'minute']}
          minuteStep={15}
          defaultValue="PT1H"
        />
      </Section>

      <Section
        id="range"
        title="Range"
        note="Out-of-range durations are reported and marked, never silently dropped."
      >
        <DurationInput
          label="Session length"
          min="PT15M"
          max="PT2H"
          value={ranged}
          onChange={setRanged}
          onWarn={() => undefined}
        />
        <p data-testid="range-value">{ranged ?? 'null'}</p>
      </Section>

      <Section id="warnings" title="Diagnostics" note="onWarn receives every rejected prop.">
        <DurationInput
          label="Misconfigured on purpose"
          defaultValue="P1M"
          onWarn={(warning) => {
            setWarnings((previous) =>
              previous.some((w) => w.code === warning.code) ? previous : [...previous, warning],
            )
          }}
        />
        <ul data-testid="warning-codes">
          {warnings.map((warning) => (
            <li key={warning.code}>{warning.code}</li>
          ))}
        </ul>
      </Section>

      <Section
        id="native-form"
        title="Native form"
        note="Posts the ISO 8601 duration as a hidden field."
      >
        <form
          onSubmit={(event) => {
            event.preventDefault()
            const entry = new FormData(event.currentTarget).get('lasts')
            setSubmitted(typeof entry === 'string' ? entry : '')
          }}
        >
          <DurationInput label="Lasts" name="lasts" defaultValue="PT1H30M" />
          <button type="submit">Save</button>
        </form>
        <p data-testid="submitted">{submitted ?? ''}</p>
      </Section>

      <Section id="states" title="States" note="Disabled and read-only.">
        <p data-testid="state-disabled">
          <DurationInput label="Disabled duration" disabled defaultValue="PT1H30M" />
        </p>
        <p data-testid="state-readonly">
          <DurationInput
            label="Read-only duration"
            readOnly
            value="PT1H30M"
            onChange={() => undefined}
          />
        </p>
      </Section>
    </>
  )
}
