import { useState } from 'react'
import { Section } from '@rxova/demo-kit'
import { MeasurementInput, compareMeasurements, toBaseUnit } from '@rxova/react-measurement-input'
import type { MeasurementWarning } from '@rxova/react-measurement-input'

/**
 * The E2E target. Every section is something the Playwright suite drives, so
 * this doubles as the manual-QA page and as the page-level accessibility scan
 * subject — several problems (duplicate ids across instances, tab order across
 * a whole form) only exist in composition and cannot be caught by a component
 * test.
 */
export function MeasurementDemos() {
  const [value, setValue] = useState<string | null>('71 inch')
  const [ranged, setRanged] = useState<string | null>(null)
  const [metric, setMetric] = useState(false)
  const [warnings, setWarnings] = useState<MeasurementWarning[]>([])
  const [submitted, setSubmitted] = useState<string | null>(null)

  return (
    <>
      <Section id="basic" title="Basic" note="Uncontrolled, metres and centimetres.">
        <MeasurementInput label="How tall" name="how-tall" />
      </Section>

      <Section
        id="units"
        title="Units"
        note="Any units of one dimension whose adjacent pairs divide exactly. The largest one on screen is unbounded."
      >
        <p data-testid="units-imperial">
          <MeasurementInput label="Height" units={['foot', 'inch']} defaultValue="71 inch" />
        </p>
        <p data-testid="units-metric">
          <MeasurementInput
            label="Height, metric"
            units={['meter', 'centimeter']}
            defaultValue="180 centimeter"
          />
        </p>
        <p data-testid="units-mass">
          <MeasurementInput label="Weight" units={['stone', 'pound']} defaultValue="170 pound" />
        </p>
        <p data-testid="units-single">
          <MeasurementInput
            label="Centimetres only"
            units={['centimeter']}
            defaultValue="180 centimeter"
          />
        </p>
      </Section>

      <Section
        id="temperature"
        title="Temperature"
        note="An offset scale, not a ratio. Single-unit, signed, and one decimal place."
      >
        <p data-testid="temp-c">
          <MeasurementInput
            label="Body temperature"
            units={['celsius']}
            precision={1}
            step={0.1}
            defaultValue="36.6 celsius"
          />
        </p>
        <p data-testid="temp-f">
          <MeasurementInput
            label="Body temperature, Fahrenheit"
            units={['fahrenheit']}
            precision={1}
            step={0.1}
            defaultValue="97.9 fahrenheit"
          />
        </p>
      </Section>

      <Section
        id="locales"
        title="Locales"
        note="The suffixes and the segment names come from Intl, not from a bundled table."
      >
        <p data-testid="locale-en">
          <MeasurementInput
            label="English"
            locale="en-GB"
            units={['foot', 'inch']}
            defaultValue="71 inch"
          />
        </p>
        <p data-testid="locale-de">
          <MeasurementInput
            label="German"
            locale="de-DE"
            units={['foot', 'inch']}
            defaultValue="71 inch"
          />
        </p>
        <p data-testid="locale-fr">
          <MeasurementInput
            label="French"
            locale="fr-FR"
            units={['meter', 'centimeter']}
            defaultValue="180 centimeter"
          />
        </p>
      </Section>

      <Section
        id="controlled"
        title="Controlled"
        note="The value is the smallest unit on screen. Two equal measurements are not === equal — use compareMeasurements."
      >
        <MeasurementInput
          label="Controlled height"
          units={['foot', 'inch']}
          value={value}
          onChange={setValue}
        />
        <p data-testid="value">{value ?? 'null'}</p>
        <p data-testid="value-base">{value === null ? 'null' : String(toBaseUnit(value))}</p>
        <p data-testid="value-compare">
          {value === null ? 'null' : String(compareMeasurements(value, '1.8034 meter'))}
        </p>
        <button
          type="button"
          onClick={() => {
            // The same height, written in another unit. The field converts it.
            setValue('1.8034 meter')
          }}
        >
          As metres
        </button>
        <button
          type="button"
          onClick={() => {
            setValue('60 inch')
          }}
        >
          Five foot
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
        id="toggle"
        title="Switching units"
        note="Changing units converts what is on screen rather than clearing it."
      >
        <MeasurementInput
          label="Toggled height"
          units={metric ? ['meter', 'centimeter'] : ['foot', 'inch']}
          defaultValue="71 inch"
        />
        <button
          type="button"
          onClick={() => {
            setMetric((on) => !on)
          }}
        >
          Toggle units
        </button>
      </Section>

      <Section
        id="carry"
        title="Overflow carries"
        note="Type 14 into the inches and leave the field: it settles to 1 ft 2 in."
      >
        <MeasurementInput label="Carrying height" units={['foot', 'inch']} name="carry" />
      </Section>

      <Section
        id="steps"
        title="Steps"
        note="Arrow keys walk a grid. They clamp at each end rather than wrapping — a measurement has no cycle."
      >
        <MeasurementInput
          label="Parcel weight"
          units={['kilogram', 'gram']}
          step={50}
          defaultValue="1500 gram"
        />
      </Section>

      <Section
        id="range"
        title="Range"
        note="Bounds may be written in any unit of the dimension. Out-of-range values are reported and marked, never silently dropped."
      >
        <MeasurementInput
          label="Adult height"
          units={['foot', 'inch']}
          min="1.4 meter"
          max="2.1 meter"
          value={ranged}
          onChange={setRanged}
          onWarn={() => undefined}
        />
        <p data-testid="range-value">{ranged ?? 'null'}</p>
      </Section>

      <Section id="warnings" title="Diagnostics" note="onWarn receives every rejected prop.">
        <MeasurementInput
          label="Misconfigured on purpose"
          units={['meter', 'inch']}
          defaultValue="90 minute"
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
        note="Posts the amount and its unit as one hidden field."
      >
        <form
          onSubmit={(event) => {
            event.preventDefault()
            const entry = new FormData(event.currentTarget).get('height')
            setSubmitted(typeof entry === 'string' ? entry : '')
          }}
        >
          <MeasurementInput
            label="Height"
            units={['foot', 'inch']}
            name="height"
            defaultValue="71 inch"
          />
          <button type="submit">Save</button>
        </form>
        <p data-testid="submitted">{submitted ?? ''}</p>
      </Section>

      <Section id="states" title="States" note="Disabled and read-only.">
        <p data-testid="state-disabled">
          <MeasurementInput
            label="Disabled height"
            units={['foot', 'inch']}
            disabled
            defaultValue="71 inch"
          />
        </p>
        <p data-testid="state-readonly">
          <MeasurementInput
            label="Read-only height"
            units={['foot', 'inch']}
            readOnly
            value="71 inch"
            onChange={() => undefined}
          />
        </p>
      </Section>
    </>
  )
}
