import { useState } from 'react'
import { Section } from '@rxova/demo-kit'
import { PasswordInput, commonRules } from '@rxova/react-password-input'
import type { PasswordWarning } from '@rxova/react-password-input'

/**
 * The E2E target. Every section is something the Playwright suite drives, so
 * this doubles as the manual-QA page and as the page-level accessibility scan
 * subject — several problems (duplicate ids across instances, tab order across
 * a whole form) only exist in composition and cannot be caught by a component
 * test.
 */
export function PasswordDemos() {
  const [controlled, setControlled] = useState('')
  const [valid, setValid] = useState(false)
  const [warnings, setWarnings] = useState<PasswordWarning[]>([])
  const [submitted, setSubmitted] = useState<string | null>(null)

  return (
    <>
      <Section id="basic" title="Sign in" note="Masked by default, with a reveal toggle.">
        <PasswordInput label="Password" name="password" autoComplete="current-password" />
      </Section>

      <Section
        id="strength"
        title="Sign up"
        note="Strength meter, requirement checklist, and a minimum score."
      >
        <PasswordInput
          label="Choose a password"
          name="new-password"
          autoComplete="new-password"
          showStrength
          minScore={2}
          userInputs={['ada@example.com', 'Ada Lovelace']}
          blocklist={['rxova']}
          rules={[
            {
              id: 'length',
              label: 'At least 10 characters',
              test: (p) => Array.from(p).length >= 10,
            },
            commonRules.digit,
            { ...commonRules.symbol, optional: true },
          ]}
          value={controlled}
          onChange={setControlled}
          onValidityChange={setValid}
        />
        <p data-testid="validity">{valid ? 'Ready to submit' : 'Not yet'}</p>
      </Section>

      <Section
        id="caps"
        title="Caps Lock"
        note="Turn Caps Lock on and focus the field — the warning is a live region."
      >
        <PasswordInput label="Password with Caps Lock warning" name="caps" />
      </Section>

      <Section
        id="breach"
        title="Breach check"
        note="A stand-in for a k-anonymity lookup. The library never makes the request itself."
      >
        <PasswordInput
          label="Password checked against a breach list"
          name="breach"
          checkCompromisedDelay={150}
          // Deliberately local: the point of the callback shape is that the
          // plaintext never leaves the page unless the app sends it.
          checkCompromised={(password) =>
            Promise.resolve(['hunter2', 'password', 'letmein'].includes(password))
          }
        />
      </Section>

      <Section id="warnings" title="Diagnostics" note="onWarn receives every coerced prop.">
        <PasswordInput
          label="Misconfigured on purpose"
          name="warned"
          minLength={-3}
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

      <Section id="native-form" title="Native form" note="Posts as an ordinary field.">
        <form
          onSubmit={(event) => {
            event.preventDefault()
            const entry = new FormData(event.currentTarget).get('secret')
            setSubmitted(typeof entry === 'string' ? entry : '')
          }}
        >
          <PasswordInput label="Secret" name="secret" defaultValue="hunter2" />
          <button type="submit">Sign in</button>
        </form>
        <p data-testid="submitted">{submitted ?? ''}</p>
      </Section>

      <Section id="states" title="States" note="Disabled and read-only.">
        <PasswordInput label="Disabled password" name="disabled" disabled defaultValue="hunter2" />
        <PasswordInput
          label="Read-only password"
          name="readonly"
          readOnly
          value="hunter2"
          onChange={() => undefined}
        />
      </Section>
    </>
  )
}
