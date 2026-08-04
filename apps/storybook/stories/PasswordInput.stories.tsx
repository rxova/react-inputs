import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { PasswordInput, commonRules, usePasswordInput } from '@rxova/react-password-input'

const meta = {
  title: 'Components/Password input',
  component: PasswordInput,
  args: {
    label: 'Password',
    placeholder: 'Your password',
    showStrength: false,
    hideRevealToggle: false,
    hideOnBlur: true,
    capsLockWarning: true,
    minLength: 8,
    disabled: false,
    readOnly: false,
    invalid: false,
    required: false,
    onChange: fn(),
    onRevealChange: fn(),
    onValidityChange: fn(),
  },
  argTypes: {
    minScore: { control: 'select', options: [null, 0, 1, 2, 3, 4] },
    minLength: { control: { type: 'number', min: 1, max: 64, step: 1 } },
    autoComplete: {
      control: 'inline-radio',
      options: ['current-password', 'new-password'],
    },
    value: { control: false },
    revealed: { control: false },
    // Functions, nodes and refs have no useful control representation.
    rules: { control: false },
    estimate: { control: false },
    strengthLabel: { control: false },
    revealIcon: { control: false },
    revealLabel: { control: false },
    checkCompromised: { control: false },
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
} satisfies Meta<typeof PasswordInput>

export default meta
type Story = StoryObj<typeof meta>

/** Every prop is live in the Controls panel; the spies log to Actions. */
export const Playground: Story = {}

/**
 * The strength meter. The built-in estimator is a ~1 kB entropy model with
 * penalties — no wordlist, no network, nothing leaves the browser.
 */
export const WithStrengthMeter: Story = {
  args: { showStrength: true, defaultValue: 'correct horse battery' },
}

/**
 * NIST SP 800-63B leads with length and advises against composition rules, so
 * the default is a single length rule. `commonRules` is there when a policy
 * demands more.
 */
export const WithRuleChecklist: Story = {
  args: {
    showStrength: true,
    showRules: true,
    rules: Object.values(commonRules),
    autoComplete: 'new-password',
    label: 'Choose a password',
  },
}

/**
 * `userInputs` penalises a password containing anything the user already typed
 * elsewhere. Type "ada@example.com" variations to watch the score collapse.
 */
export const PenalisedAgainstUserInput: Story = {
  args: {
    showStrength: true,
    label: 'New password',
    autoComplete: 'new-password',
    userInputs: ['ada@example.com', 'Ada Lovelace'],
    blocklist: ['rxova'],
    defaultValue: 'ada@example.com1',
  },
}

/** `minScore` gates validity on the meter, not just on the rules. */
export const GatedOnScore: Story = {
  args: {
    showStrength: true,
    minScore: 3,
    autoComplete: 'new-password',
    label: 'Password (must reach Good)',
  },
}

/** Controlled reveal: the toggle is owned by the consumer, not the component. */
export const ControlledReveal: Story = {
  render: function ControlledReveal(args) {
    const [revealed, setRevealed] = useState(true)
    return (
      <>
        <PasswordInput {...args} revealed={revealed} onRevealChange={setRevealed} />
        <button
          type="button"
          onClick={() => {
            setRevealed((r) => !r)
          }}
        >
          {revealed ? 'Hide' : 'Show'} from outside
        </button>
      </>
    )
  },
  args: { defaultValue: 'hunter2' },
}

/** No reveal button at all, for flows where showing the value is unacceptable. */
export const WithoutRevealToggle: Story = {
  args: { hideRevealToggle: true, defaultValue: 'hunter2' },
}

/**
 * `checkCompromised` is the breach-check hook. The library never makes a
 * network request itself — wire this to a k-anonymity endpoint and keep the
 * plaintext local. This story fakes one that flags anything containing
 * "password".
 */
export const CompromisedCheck: Story = {
  args: {
    label: 'New password',
    autoComplete: 'new-password',
    showStrength: true,
    defaultValue: 'password123',
    checkCompromised: (password: string) =>
      Promise.resolve(password.toLowerCase().includes('password')),
    checkCompromisedDelay: 200,
  },
}

/** `invalid` sets `aria-invalid` and `data-invalid`; the ring is a consumer token. */
export const Invalid: Story = {
  render: (args) => (
    <>
      <PasswordInput {...args} invalid aria-describedby="pw-invalid-help" />
      <p id="pw-invalid-help" className="error">
        That password is not correct
      </p>
    </>
  ),
  args: { defaultValue: 'wrong' },
}

/** Disabled: exposed to assistive tech, not editable. */
export const Disabled: Story = {
  args: { disabled: true, defaultValue: 'hunter2' },
}

/** Read-only: the value is shown and focusable, but not editable. */
export const ReadOnly: Story = {
  args: { readOnly: true, defaultValue: 'hunter2' },
}

/**
 * A confirm-password pair. Both fields are plain `PasswordInput`s; the match
 * check is the consumer's, because only the consumer knows what to say about it.
 */
export const ConfirmPassword: Story = {
  render: function ConfirmPassword(args) {
    const [password, setPassword] = useState('')
    const [confirm, setConfirm] = useState('')
    const mismatch = confirm.length > 0 && confirm !== password

    return (
      <>
        <PasswordInput
          {...args}
          label="New password"
          autoComplete="new-password"
          showStrength
          value={password}
          onChange={setPassword}
        />
        <PasswordInput
          {...args}
          label="Confirm password"
          autoComplete="new-password"
          showStrength={false}
          value={confirm}
          onChange={setConfirm}
          invalid={mismatch}
          aria-describedby={mismatch ? 'pw-confirm-help' : undefined}
        />
        {mismatch && (
          <p id="pw-confirm-help" className="error">
            Both passwords must match
          </p>
        )}
      </>
    )
  },
}

/**
 * With `name` set the value posts through native form submission — no form
 * library required. Submit to see the `FormData` payload.
 */
export const InAForm: Story = {
  render: function InAForm(args) {
    const [submitted, setSubmitted] = useState<string | null>(null)
    return (
      <form
        className="story"
        onSubmit={(e) => {
          e.preventDefault()
          setSubmitted(JSON.stringify(Object.fromEntries(new FormData(e.currentTarget))))
        }}
      >
        <PasswordInput {...args} name="password" />
        <button type="submit">Submit</button>
        <output>{submitted ?? 'not submitted'}</output>
      </form>
    )
  },
}

/**
 * Tier 4: the raw hook. `usePasswordInput` owns the value, the reveal state,
 * the estimator and the Caps Lock flag, and exposes them as primitives — the
 * markup below is entirely hand-rolled, with no `PasswordInput` involved.
 */
export const HeadlessHook: Story = {
  render: function HeadlessHook() {
    const password = usePasswordInput({ minLength: 8 })
    return (
      <div>
        <label htmlFor={password.ids.input}>Password (hand-rolled)</label>
        <input
          id={password.ids.input}
          ref={password.inputRef}
          type={password.type}
          value={password.value}
          onChange={(e) => {
            password.setValue(e.target.value)
          }}
          onKeyDown={password.handleModifierEvent}
          onKeyUp={password.handleModifierEvent}
          aria-describedby={password.ids.strength}
        />
        <button
          type="button"
          onMouseDown={password.captureSelection}
          onClick={password.toggleReveal}
        >
          {password.revealed ? 'Hide' : 'Show'}
        </button>
        <p id={password.ids.strength}>
          score {password.strength.score} · {password.strength.entropy.toFixed(0)} bits ·{' '}
          {password.valid ? 'valid' : 'not yet valid'}
        </p>
        {password.capsLock && <p className="error">Caps Lock is on</p>}
      </div>
    )
  },
}
