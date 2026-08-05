<p align="center">
  <img src="./assets/logo.svg" alt="@rxova/react-password-input logo" width="180" />
</p>

<h1 align="center">@rxova/react-password-input</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/@rxova/react-password-input"><img src="https://img.shields.io/npm/v/@rxova/react-password-input?color=cb3837&logo=npm&logoColor=white" alt="npm version" /></a>
  <a href="https://github.com/rxova/react-inputs/actions/workflows/ci.yml"><img src="https://github.com/rxova/react-inputs/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI status" /></a>
  <img src="https://img.shields.io/badge/brotli-%E2%89%A4%205%20kB-f5a623" alt="Brotli size at most 5 kB" />
  <img src="https://img.shields.io/badge/coverage%20threshold-95%25-brightgreen" alt="Coverage threshold: 95% per file" />
  <img src="https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white" alt="TypeScript strict mode" />
  <img src="https://img.shields.io/badge/dependencies-0-44cc11" alt="Zero runtime dependencies" />
  <img src="https://img.shields.io/badge/React-%E2%89%A518-61dafb?logo=react&logoColor=white" alt="React 18 or newer" />
  <a href="https://github.com/rxova/react-inputs/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT license" /></a>
</p>

**Reveal toggle, Caps Lock warning, and a strength meter that costs 1.2 kB instead of 400.**
A headless, zero-dependency React password input.

```bash
npm install @rxova/react-password-input
```

📖 **[Documentation & live examples →](https://rxova.org/packages/react-inputs/components/password/introduction/)** — guides, form recipes, theming, breach checks, and migration from another password field.

- **A strength meter you can actually ship** — 1.2 kB brotli, no wordlists. Swap in zxcvbn with
  one prop if you want them.
- **A reveal toggle that keeps your caret** — every engine loses the selection when an input's
  `type` changes; this one puts it back
- **Caps Lock warning** read off the real modifier, so a lock set before the field had focus is
  still caught
- **Breach checks without a network call** — you supply the lookup, the plaintext never leaves
  the page on its own
- **NIST SP 800-63B by default** — length first, no composition rules, long passphrases never
  truncated
- **Zero runtime dependencies**, 4.8 kB brotli for the whole component, no stylesheet to import

## Sign in

The minimum useful field: masked, with a reveal toggle and a Caps Lock warning.

```tsx
import { PasswordInput } from '@rxova/react-password-input'

function SignIn() {
  return <PasswordInput label="Password" name="password" autoComplete="current-password" />
}
```

## Sign up

Turn on the meter and the checklist. `onValidityChange` fires on transitions only, so it is safe
to wire straight into state.

```tsx
import { useState } from 'react'
import { PasswordInput, commonRules } from '@rxova/react-password-input'

function SignUp({ email }: { email: string }) {
  const [valid, setValid] = useState(false)

  return (
    <>
      <PasswordInput
        label="Choose a password"
        name="password"
        autoComplete="new-password"
        showStrength
        minScore={3}
        minLength={10}
        userInputs={[email]}
        blocklist={['acme', 'acmecorp']}
        rules={[commonRules.digit, { ...commonRules.symbol, optional: true }]}
        onValidityChange={setValid}
      />
      <button type="submit" disabled={!valid}>
        Create account
      </button>
    </>
  )
}
```

`userInputs` is the highest-value option here and the one most often left out: a password
containing the user's own email or name is trivially guessable, and nothing but your app knows
what those are. Values are compared locally and never leave the browser.

## Strength

`estimateStrength` is a pure function you can call directly.

```ts
import { estimateStrength } from '@rxova/react-password-input'

const result = estimateStrength('Tr0ub4dor&3', { userInputs: ['ada@example.com'] })
// { score: 3, entropy: 72.27, penalties: [], effectiveLength: 11 }
```

| Field             | Meaning                                                              |
| ----------------- | -------------------------------------------------------------------- |
| `score`           | 0–4 bucket. What the meter paints.                                   |
| `entropy`         | Estimated bits **after** penalties. A comparator, not a measurement. |
| `penalties`       | Machine-readable reasons the score is not higher, ordered by impact. |
| `effectiveLength` | Length after collapsing repeats and runs.                            |

Penalty codes: `too-short`, `single-class`, `repeated-characters`, `sequential-characters`,
`blocklisted`, `contains-user-input`.

### What it models, and what it does not

It models four things a wordlist-free estimator can model honestly: the character pool, length,
structural repetition (`aaaa`, `abcd`, `qwerty`), and context you supply (`blocklist`,
`userInputs`). It carries ~50 corpus staples and sees through leet substitutions, so `P4ssw0rd`
scores zero.

It does **not** know English. `Tr0ub4dor&3` scores 3 here because nothing on the client knows
"troubadour" is a word — that is precisely what zxcvbn's 350 kB (minified + brotli) of wordlists
buys. If you need
that, buy it deliberately:

```tsx
import { zxcvbn } from '@zxcvbn-ts/core'
import { PasswordInput } from '@rxova/react-password-input'
import type { PasswordScore } from '@rxova/react-password-input'

function Field() {
  return (
    <PasswordInput
      label="Password"
      showStrength
      estimate={(password) => {
        const result = zxcvbn(password)
        return {
          score: result.score as PasswordScore,
          entropy: Math.log2(result.guesses),
          penalties: [],
          effectiveLength: password.length,
        }
      }}
    />
  )
}
```

A custom `estimate` that throws is contained: the meter falls back to the built-in estimator and
`onWarn` reports `estimate-threw`. One bad adapter does not take the login form down.

The meter is a nudge, not an authorisation decision. The defences that matter are a length floor,
a breach-corpus check, and rate limiting on the server.

## Breach checks

`checkCompromised` is the only way this component learns anything about the outside world, and it
is entirely yours. The library issues no request of its own — that is the point of the shape.

```tsx
import { PasswordInput } from '@rxova/react-password-input'

/** Have I Been Pwned's k-anonymity API: only a 5-character hash prefix is sent. */
async function checkPwned(password: string, signal: AbortSignal) {
  const bytes = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(password))
  const hash = [...new Uint8Array(bytes)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
  const response = await fetch(`https://api.pwnedpasswords.com/range/${hash.slice(0, 5)}`, {
    signal,
  })
  return (await response.text()).includes(hash.slice(5))
}

function Field() {
  return <PasswordInput label="Password" showStrength checkCompromised={checkPwned} />
}
```

The call is debounced (`checkCompromisedDelay`, 400 ms) and given an `AbortSignal` that fires when
the password changes again or the component unmounts, so a slow answer for an old password can
never be shown against a new one. A failed or aborted lookup reports **unknown**, never "safe" —
telling a user their password is fine because the network was down is a lie in the one direction
that matters. A known-compromised password blocks `onValidityChange`.

## Rules

The default rule set is one rule, about length. That is a deliberate reading of NIST SP 800-63B,
which requires a length minimum, requires accepting long passphrases, and says verifiers
"SHOULD NOT impose other composition rules" — the upper/lower/digit/symbol checklist trains users
into `Password1!` and measurably lowers real entropy.

If you need the checklist anyway, `commonRules` has the four:

```tsx
import { PasswordInput, commonRules } from '@rxova/react-password-input'

function Field() {
  return (
    <PasswordInput
      label="Password"
      rules={[
        commonRules.lowercase,
        commonRules.uppercase,
        commonRules.digit,
        { ...commonRules.symbol, optional: true },
      ]}
    />
  )
}
```

Rules are `{ id, label, test, optional? }`. `test` is a plain predicate; one that throws is
reported as unmet rather than taking the field down. An `optional` rule renders in the checklist
but never blocks validity. Every rule matches Unicode, not ASCII — a genuinely mixed-case German
or Greek password is not told it has no uppercase.

## Forms

The rendered element is an ordinary `<input>`, so native forms, React Hook Form, Formik, React
Final Form and TanStack Form all work with no adapter. The `ref` lands on the input itself, which
is what `setFocus()` and focus-first-error patterns expect.

```tsx
import { useForm } from 'react-hook-form'
import { PasswordInput } from '@rxova/react-password-input'

function SignIn() {
  const { register, handleSubmit } = useForm<{ password: string }>()
  const { ref, onChange, ...field } = register('password', { required: true })

  return (
    <form onSubmit={handleSubmit(() => undefined)}>
      <PasswordInput
        label="Password"
        ref={ref}
        onChange={(value) => onChange({ target: { name: field.name, value } })}
        {...field}
      />
      <button type="submit">Sign in</button>
    </form>
  )
}
```

## Styling

There is no stylesheet to import. Only layout-critical declarations are inlined; everything visual
is a CSS custom property or a `data-*` hook.

| Property                          | Default                                  | Applies to                   |
| --------------------------------- | ---------------------------------------- | ---------------------------- |
| `--rx-password-gap`               | `0.375rem`                               | Space between stacked parts  |
| `--rx-password-field-gap`         | `0.25rem`                                | Input to reveal button       |
| `--rx-password-toggle-size`       | `1.75rem`                                | Reveal button hit area       |
| `--rx-password-meter-height`      | `0.25rem`                                | Meter bar height             |
| `--rx-password-meter-gap`         | `0.125rem`                               | Space between meter segments |
| `--rx-password-meter-radius`      | `999px`                                  | Meter segment corners        |
| `--rx-password-meter-track`       | `rgba(0 0 0 / 0.15)`                     | Unfilled segment             |
| `--rx-password-meter-fill`        | `currentColor`                           | Filled segment, any score    |
| `--rx-password-meter-fill-1`…`-4` | falls back to `--rx-password-meter-fill` | Filled segment per score     |
| `--rx-password-rules-indent`      | `1.25rem`                                | Checklist indent             |

Do not shrink `--rx-password-toggle-size` below `1.5rem`: at the default font size that is the 24×24 CSS
pixels WCAG 2.5.8 Target Size (Minimum) requires.

### `data-*` attributes

These are **public API**, covered by semver.

| Attribute                         | On            | Meaning                            |
| --------------------------------- | ------------- | ---------------------------------- |
| `data-rx-password-root`           | wrapper       | Always present                     |
| `data-revealed`                   | wrapper       | Password is showing as text        |
| `data-disabled` / `data-invalid`  | wrapper       | Mirrors the props                  |
| `data-valid`                      | wrapper       | All rules met and `minScore` hit   |
| `data-score`                      | wrapper       | `0`–`4`, only when `showStrength`  |
| `data-rx-password-field`          | input row     | Input plus toggle                  |
| `data-rx-password-input`          | `<input>`     | The control itself                 |
| `data-rx-password-toggle`         | `<button>`    | The reveal toggle                  |
| `data-rx-password-caps-lock`      | warning       | Present only while Caps Lock is on |
| `data-rx-password-meter`          | meter         | `role="meter"`                     |
| `data-rx-password-segment`        | meter segment | `0`–`3`                            |
| `data-filled`                     | meter segment | Segment is lit                     |
| `data-rx-password-strength-label` | caption       | The score caption                  |
| `data-rx-password-rules`          | `<ul>`        | The checklist                      |
| `data-rule` / `data-met`          | `<li>`        | Rule id, and whether it passes     |
| `data-rx-password-compromised`    | alert         | Present only when known-breached   |
| `data-rx-password-announcement`   | live region   | Off-screen, `aria-live="polite"`   |

## Props

Full reference in the [API docs](https://rxova.org/packages/react-inputs/password). The prop
surface is `PasswordInputProps` in `types.ts`, which is public API covered by semver.

## Diagnostics

`onWarn` receives a `{ code, prop, message }` whenever the component keeps itself working despite
a prop it cannot use as given. Wire it to Sentry or your logger:

```tsx
import * as Sentry from '@sentry/react'
import { PasswordInput } from '@rxova/react-password-input'

function Field() {
  return (
    <PasswordInput
      label="Password"
      onWarn={(warning) => {
        Sentry.captureMessage(warning.message, { level: 'warning', extra: { ...warning } })
      }}
    />
  )
}
```

Codes: `min-length-negative`, `min-length-non-integer`, `max-length-below-min`,
`duplicate-rule-id`, `autocomplete-missing`, `estimate-threw`.

With no handler the same warnings go to `console.warn`. **The entire path is stripped from
production builds** — `warn.ts` sits behind a `process.env.NODE_ENV !== 'production'` branch and a
bundler drops it, so there is no runtime cost and no console noise in production. The E2E suite
asserts this against a real production bundle.

## Headless

`usePasswordInput` gives you the whole state machine with no markup, including the two parts that
are genuinely hard to get right: caret restoration across the `type` swap, and the abortable,
debounced breach check.

```tsx
import { usePasswordInput } from '@rxova/react-password-input'

function CustomField() {
  const field = usePasswordInput({ minLength: 10 })

  return (
    <div>
      <input
        ref={(node) => {
          field.inputRef.current = node
        }}
        id={field.ids.input}
        type={field.type}
        value={field.value}
        onChange={(event) => {
          field.setValue(event.target.value)
        }}
        onKeyDown={field.handleModifierEvent}
        onKeyUp={field.handleModifierEvent}
        onBlur={field.handleBlur}
      />
      <button
        type="button"
        aria-pressed={field.revealed}
        onMouseDown={(event) => {
          field.captureSelection()
          event.preventDefault()
        }}
        onClick={field.toggleReveal}
      >
        {field.revealed ? 'Hide' : 'Show'}
      </button>
      {field.capsLock ? <p role="status">Caps Lock is on</p> : null}
    </div>
  )
}
```

`captureSelection` on `mousedown` is not optional if you want the caret preserved — see
[CONSIDERATIONS.md](./CONSIDERATIONS.md).

## Accessibility

- A real `<input>`, named by `label` (or `aria-label`). The browser supplies keyboard behaviour,
  form participation and password-manager integration; none of those can be faithfully
  reimplemented. Nothing visible is rendered for the name — pair it with your own
  `<label htmlFor={id}>` when the design wants text on screen.
- The reveal control is a **toggle button** with `aria-pressed` and `aria-controls`, an explicit
  `tabindex="0"` so Safari includes it in the tab order without Full Keyboard Access, and a hit
  area that meets WCAG 2.5.8.
- Caps Lock is `role="status"`, not `role="alert"` — worth saying, not worth interrupting.
- The checklist states met/unmet **in text** as well as by marker, so meaning never rides on
  colour alone (WCAG 1.4.1).
- The strength meter carries `aria-valuetext` ("Fair"), because the bare number reads as "2" with
  no unit.
- One off-screen `aria-live="polite"` region announces the strength _bucket_ and the rule tally.
  Because the caption is bucketed rather than continuous, React only rewrites that text when the
  bucket actually changes — so it announces once on crossing into "Fair", not on every keystroke.
- `aria-describedby` is assembled from the parts that actually rendered, so it never dangles.
- axe (WCAG 2.1 A/AA) runs over the component in the browser suite and over the whole demo page in
  the E2E suite, in Chromium, Firefox and WebKit.

## Part of rxova

Part of the [rxova headless React inputs](https://rxova.org/packages/react-inputs/overview) suite —
install the whole set from
[`@rxova/react-inputs`](https://www.npmjs.com/package/@rxova/react-inputs), or read the full
generated [API reference](https://rxova.org/packages/react-inputs/components/password/api) for this package.

Cross-cutting guidance lives on this component's About page:
[styling](https://rxova.org/packages/react-inputs/components/password/about/#styling) and [form libraries](https://rxova.org/packages/react-inputs/components/password/about/#form-libraries). Coming from
another library? The [migration guide](https://rxova.org/packages/react-inputs/components/password/migrating/) maps the props across.

## License

[MIT](https://github.com/rxova/react-inputs/blob/main/LICENSE) © rxova
