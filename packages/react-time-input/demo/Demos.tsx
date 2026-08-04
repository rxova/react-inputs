import { useState } from 'react'
import { Section } from '@rxova/demo-kit'
import { TimeInput } from '@rxova/react-time-input'
import type { TimeWarning } from '@rxova/react-time-input'

/**
 * The E2E target. Every section is something the Playwright suite drives, so
 * this doubles as the manual-QA page and as the page-level accessibility scan
 * subject — several problems (duplicate ids across instances, tab order across
 * a whole form) only exist in composition and cannot be caught by a component
 * test.
 */
export function TimeDemos() {
  const [value, setValue] = useState<string | null>('09:30')
  const [ranged, setRanged] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<TimeWarning[]>([])
  const [submitted, setSubmitted] = useState<string | null>(null)

  return (
    <>
      <Section id="basic" title="Basic" note="Uncontrolled, in the browser's own locale.">
        <TimeInput label="Any time" name="any" />
      </Section>

      <Section
        id="clocks"
        title="Clocks"
        note="12- or 24-hour comes from Intl, not from a bundled table."
      >
        <p data-testid="clock-us">
          <TimeInput label="US time" locale="en-US" defaultValue="14:05" />
        </p>
        <p data-testid="clock-gb">
          <TimeInput label="UK time" locale="en-GB" defaultValue="14:05" />
        </p>
        <p data-testid="clock-ja">
          <TimeInput label="Japanese time" locale="ja-JP" hour12 defaultValue="14:05" />
        </p>
      </Section>

      <Section id="controlled" title="Controlled" note="The value is always 24-hour HH:mm.">
        <TimeInput label="Controlled time" locale="en-US" value={value} onChange={setValue} />
        <p data-testid="value">{value ?? 'null'}</p>
        <button
          type="button"
          onClick={() => {
            setValue('00:00')
          }}
        >
          Midnight
        </button>
        <button
          type="button"
          onClick={() => {
            setValue('12:00')
          }}
        >
          Noon
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
        id="seconds"
        title="Seconds and steps"
        note="Optional seconds, and a 15-minute grid."
      >
        <TimeInput
          label="Precise time"
          locale="en-GB"
          showSeconds
          minuteStep={15}
          secondStep={30}
          defaultValue="09:00:00"
        />
      </Section>

      <Section
        id="range"
        title="Range"
        note="Out-of-range times are reported and marked, never silently dropped."
      >
        <TimeInput
          label="Opening hours"
          locale="en-GB"
          min="09:00"
          max="17:00"
          value={ranged}
          onChange={setRanged}
          onWarn={() => undefined}
        />
        <p data-testid="range-value">{ranged ?? 'null'}</p>
      </Section>

      <Section id="warnings" title="Diagnostics" note="onWarn receives every rejected prop.">
        <TimeInput
          label="Misconfigured on purpose"
          locale="en-GB"
          defaultValue="2:30 PM"
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
        note="Posts the 24-hour value as a hidden field."
      >
        <form
          onSubmit={(event) => {
            event.preventDefault()
            const entry = new FormData(event.currentTarget).get('at')
            setSubmitted(typeof entry === 'string' ? entry : '')
          }}
        >
          <TimeInput label="Starts at" locale="en-US" name="at" defaultValue="14:30" />
          <button type="submit">Save</button>
        </form>
        <p data-testid="submitted">{submitted ?? ''}</p>
      </Section>

      <Section id="states" title="States" note="Disabled and read-only.">
        <p data-testid="state-disabled">
          <TimeInput label="Disabled time" locale="en-GB" disabled defaultValue="09:30" />
        </p>
        <p data-testid="state-readonly">
          <TimeInput
            label="Read-only time"
            locale="en-GB"
            readOnly
            value="09:30"
            onChange={() => undefined}
          />
        </p>
      </Section>
    </>
  )
}
