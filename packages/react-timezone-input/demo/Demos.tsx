import { useState } from 'react'
import { Section } from '@rxova/demo-kit'
import { TimezoneInput, localZone, zoneOffsetLabel, zonePhase } from '@rxova/react-timezone-input'
import type { TimezoneWarning } from '@rxova/react-timezone-input'

/**
 * The E2E target. Every section is something the Playwright suite drives, so
 * this doubles as the manual-QA page and as the page-level accessibility scan
 * subject — several problems (duplicate ids across instances, tab order across a
 * whole form) only exist in composition and cannot be caught by a component
 * test.
 */
export function TimezoneDemos() {
  const [zone, setZone] = useState<string | null>('Europe/Madrid')
  const [warnings, setWarnings] = useState<TimezoneWarning[]>([])
  const [submitted, setSubmitted] = useState<string | null>(null)
  const [summer, setSummer] = useState(false)

  const reference = new Date(Date.UTC(2026, summer ? 6 : 0, 15))

  return (
    <>
      <Section id="basic" title="Basic" note="Uncontrolled, every zone the platform knows.">
        <TimezoneInput label="Time zone" name="tz" />
      </Section>

      <Section
        id="utc"
        title="UTC"
        note="Intl.supportedValuesOf('timeZone') does not contain UTC. This field adds it, first."
      >
        <TimezoneInput label="With UTC" defaultValue="UTC" />
      </Section>

      <Section
        id="controlled"
        title="Controlled"
        note="The value is an IANA id. The offset is derived from it, never stored."
      >
        <TimezoneInput label="Controlled zone" value={zone} onChange={setZone} />
        <p data-testid="value">{zone ?? 'null'}</p>
        <p data-testid="value-offset">{zone === null ? 'null' : (zoneOffsetLabel(zone) ?? '')}</p>
        <p data-testid="value-phase">{zone === null ? 'null' : (zonePhase(zone, 'en') ?? '')}</p>
        <button
          type="button"
          onClick={() => {
            setZone('Asia/Tokyo')
          }}
        >
          Tokyo
        </button>
        <button
          type="button"
          onClick={() => {
            setZone(null)
          }}
        >
          Clear
        </button>
        <button
          type="button"
          onClick={() => {
            setZone(localZone())
          }}
        >
          Use my zone
        </button>
      </Section>

      <Section
        id="renamed"
        title="A renamed zone"
        note="Europe/Kyiv and Europe/Kiev are the same place. Whichever this engine lists, the other one still selects it."
      >
        <div data-testid="renamed-modern">
          <TimezoneInput label="Stored as Kyiv" value="Europe/Kyiv" onChange={() => undefined} />
        </div>
        <div data-testid="renamed-legacy">
          <TimezoneInput label="Stored as Kiev" value="Europe/Kiev" onChange={() => undefined} />
        </div>
      </Section>

      <Section
        id="reference"
        title="Reference date"
        note="An offset is a fact about an instant, not about a zone. Toggle the season and watch them move."
      >
        <TimezoneInput
          label="Offsets at a date"
          zones={['America/New_York', 'Australia/Sydney', 'Europe/Madrid', 'UTC']}
          referenceDate={reference}
          defaultValue="America/New_York"
        />
        <button
          type="button"
          onClick={() => {
            setSummer((on) => !on)
          }}
        >
          Toggle season
        </button>
        <p data-testid="reference-season">{summer ? 'July' : 'January'}</p>
      </Section>

      <Section
        id="narrow"
        title="A shortlist"
        note="Restrict the list to the zones an application actually serves. UTC stays available."
      >
        <TimezoneInput
          label="Office"
          zones={['Europe/Madrid', 'America/New_York', 'Asia/Tokyo']}
          defaultValue="Europe/Madrid"
        />
      </Section>

      <Section id="flat" title="Ungrouped" note="Without optgroups, sorted by offset.">
        <TimezoneInput label="Flat list" grouped={false} defaultValue="UTC" />
      </Section>

      <Section id="warnings" title="Diagnostics" note="onWarn receives every rejected prop.">
        <TimezoneInput
          label="Misconfigured on purpose"
          defaultValue="+02:00"
          zones={['Europe/Madrid', 'Mars/Olympus']}
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
        note="The select posts itself; no hidden input."
      >
        <form
          onSubmit={(event) => {
            event.preventDefault()
            const entry = new FormData(event.currentTarget).get('zone')
            setSubmitted(typeof entry === 'string' ? entry : '')
          }}
        >
          <TimezoneInput label="Zone" name="zone" defaultValue="Europe/Madrid" />
          <button type="submit">Save</button>
        </form>
        <p data-testid="submitted">{submitted ?? ''}</p>
      </Section>

      <Section id="states" title="States" note="Disabled and invalid.">
        <div data-testid="state-disabled">
          <TimezoneInput label="Disabled zone" disabled defaultValue="UTC" />
        </div>
        <div data-testid="state-invalid">
          <TimezoneInput label="Invalid zone" invalid defaultValue="UTC" />
        </div>
      </Section>
    </>
  )
}
