import { useState } from 'react'
import { Section } from '@rxova/demo-kit'
import { PhoneInput } from '@rxova/react-phone-input'
import type { PhoneDetails, PhoneWarning } from '@rxova/react-phone-input'

/**
 * The E2E target. Every section is something the Playwright suite drives, so
 * this doubles as the manual-QA page and as the page-level accessibility scan
 * subject — several problems (duplicate ids across instances, tab order across
 * a whole form) only exist in composition and cannot be caught by a component
 * test.
 */
export function PhoneDemos() {
  const [details, setDetails] = useState<PhoneDetails | null>(null)
  const [warnings, setWarnings] = useState<PhoneWarning[]>([])
  const [submitted, setSubmitted] = useState<string | null>(null)

  return (
    <>
      <Section id="basic" title="Basic" note="Country select plus a national number.">
        <PhoneInput label="Phone number" name="phone" defaultCountry="US" locale="en" />
      </Section>

      <Section
        id="validity"
        title="Validity feedback"
        note="Reported after the field is left, never while typing."
      >
        <PhoneInput label="Checked number" defaultCountry="US" locale="en" showValidity />
      </Section>

      <Section
        id="details"
        title="What onChange reports"
        note="E.164 out, plus the country, the national digits and whether the length is possible."
      >
        <PhoneInput
          label="Reported number"
          defaultCountry="GB"
          locale="en"
          onChange={(_value, next) => {
            setDetails(next)
          }}
        />
        <p data-testid="e164">{details?.e164 ?? ''}</p>
        <p data-testid="country">{details?.country ?? ''}</p>
        <p data-testid="possible">{details === null ? '' : String(details.possible)}</p>
      </Section>

      <Section
        id="restricted"
        title="A shorter list"
        note="Restrict the picker, in the order you give."
      >
        <PhoneInput
          label="European number"
          countries={['GB', 'IE', 'FR', 'DE', 'ES']}
          defaultCountry="GB"
          locale="en"
        />
      </Section>

      <Section id="locale" title="Localised names" note="Country names come from Intl.">
        <PhoneInput
          label="Numéro de téléphone"
          countries={['FR', 'DE', 'GB']}
          defaultCountry="FR"
          locale="fr"
        />
      </Section>

      <Section
        id="no-select"
        title="International only"
        note="No picker; the number must carry its own calling code."
      >
        <PhoneInput
          label="International number"
          hideCountrySelect
          defaultValue="+442071234567"
          locale="en"
        />
      </Section>

      <Section id="warnings" title="Diagnostics" note="onWarn receives every rejected prop.">
        <PhoneInput
          label="Misconfigured on purpose"
          defaultCountry="ZZ"
          locale="en"
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

      <Section id="native-form" title="Native form" note="Posts E.164 as a hidden field.">
        <form
          onSubmit={(event) => {
            event.preventDefault()
            const entry = new FormData(event.currentTarget).get('mobile')
            setSubmitted(typeof entry === 'string' ? entry : '')
          }}
        >
          <PhoneInput
            label="Mobile"
            name="mobile"
            defaultCountry="US"
            defaultValue="+14155552671"
            locale="en"
          />
          <button type="submit">Save</button>
        </form>
        <p data-testid="submitted">{submitted ?? ''}</p>
      </Section>

      <Section id="states" title="States" note="Disabled and read-only.">
        <p data-testid="state-disabled">
          <PhoneInput label="Disabled phone" disabled defaultValue="+14155552671" locale="en" />
        </p>
        <p data-testid="state-readonly">
          <PhoneInput
            label="Read-only phone"
            readOnly
            value="+14155552671"
            onChange={() => undefined}
            locale="en"
          />
        </p>
      </Section>
    </>
  )
}
