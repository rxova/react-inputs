import { useState } from 'react'
import { Section } from '@rxova/demo-kit'
import { DateInput } from '@rxova/react-date-input'
import type { DateWarning } from '@rxova/react-date-input'

/**
 * The E2E target. Every section is something the Playwright suite drives, so
 * this doubles as the manual-QA page and as the page-level accessibility scan
 * subject — several problems (duplicate ids across instances, tab order across
 * a whole form) only exist in composition and cannot be caught by a component
 * test.
 */
export function DateDemos() {
  const [value, setValue] = useState<string | null>('2026-03-15')
  const [ranged, setRanged] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<DateWarning[]>([])
  const [submitted, setSubmitted] = useState<string | null>(null)

  return (
    <>
      <Section id="basic" title="Basic" note="Uncontrolled, in the browser's own locale.">
        <DateInput label="Any date" name="any" />
      </Section>

      <Section
        id="locales"
        title="Locales"
        note="Segment order and separators come from Intl, not from a bundled table."
      >
        <p data-testid="locale-us">
          <DateInput label="US date" locale="en-US" defaultValue="2026-03-15" />
        </p>
        <p data-testid="locale-gb">
          <DateInput label="UK date" locale="en-GB" defaultValue="2026-03-15" />
        </p>
        <p data-testid="locale-jp">
          <DateInput label="Japanese date" locale="ja-JP" defaultValue="2026-03-15" />
        </p>
        <p data-testid="locale-de">
          <DateInput label="German date" locale="de-DE" defaultValue="2026-03-15" />
        </p>
      </Section>

      <Section id="controlled" title="Controlled" note="The value is always a YYYY-MM-DD string.">
        <DateInput label="Controlled date" locale="en-GB" value={value} onChange={setValue} />
        <p data-testid="value">{value ?? 'null'}</p>
        <button
          type="button"
          onClick={() => {
            setValue('2024-02-29')
          }}
        >
          Set leap day
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
        id="range"
        title="Range"
        note="Out-of-range dates are reported and marked, never silently dropped."
      >
        <DateInput
          label="Date in 2026"
          locale="en-GB"
          min="2026-01-01"
          max="2026-12-31"
          value={ranged}
          onChange={setRanged}
          onWarn={() => undefined}
        />
        <p data-testid="range-value">{ranged ?? 'null'}</p>
      </Section>

      <Section id="warnings" title="Diagnostics" note="onWarn receives every rejected prop.">
        <DateInput
          label="Misconfigured on purpose"
          locale="en-GB"
          defaultValue="03/01/2026"
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

      <Section id="native-form" title="Native form" note="Posts the ISO value as a hidden field.">
        <form
          onSubmit={(event) => {
            event.preventDefault()
            const entry = new FormData(event.currentTarget).get('due')
            setSubmitted(typeof entry === 'string' ? entry : '')
          }}
        >
          <DateInput label="Due" locale="en-GB" name="due" defaultValue="2026-03-15" />
          <button type="submit">Save</button>
        </form>
        <p data-testid="submitted">{submitted ?? ''}</p>
      </Section>

      <Section id="states" title="States" note="Disabled and read-only.">
        <p data-testid="state-disabled">
          <DateInput label="Disabled date" locale="en-GB" disabled defaultValue="2026-03-15" />
        </p>
        <p data-testid="state-readonly">
          <DateInput
            label="Read-only date"
            locale="en-GB"
            readOnly
            value="2026-03-15"
            onChange={() => undefined}
          />
        </p>
      </Section>
    </>
  )
}
