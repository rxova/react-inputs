<h1 align="center">@rxova/react-phone-input</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/@rxova/react-phone-input"><img src="https://img.shields.io/npm/v/@rxova/react-phone-input?color=cb3837&logo=npm&logoColor=white" alt="npm version" /></a>
  <a href="https://github.com/rxova/react-inputs/actions/workflows/ci.yml"><img src="https://github.com/rxova/react-inputs/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI status" /></a>
  <img src="https://img.shields.io/badge/brotli-%E2%89%A4%204.25%20kB-f5a623" alt="Brotli size at most 4.25 kB" />
  <img src="https://img.shields.io/badge/coverage-100%25-brightgreen" alt="100% coverage" />
  <img src="https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white" alt="TypeScript strict mode" />
  <img src="https://img.shields.io/badge/dependencies-0-44cc11" alt="Zero runtime dependencies" />
  <img src="https://img.shields.io/badge/React-%E2%89%A518-61dafb?logo=react&logoColor=white" alt="React 18 or newer" />
  <a href="https://github.com/rxova/react-inputs/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT license" /></a>
</p>

**International phone input with no metadata blob.** Country names from `Intl`, flags from Unicode,
4 kB of dial codes. Headless, zero-dependency.

```bash
npm install @rxova/react-phone-input
```

📖 **[Documentation & live examples →](https://rxova.org/packages/react-inputs/components/phone/introduction/)** — guides, form recipes, theming, the possible-versus-valid distinction, and migration from another phone library.

- **10x smaller than the default choice.** 4.1 kB brotli against `react-phone-number-input`'s
  41.1 kB: names come from `Intl.DisplayNames`, flags are two regional-indicator letters, and all
  that is left to ship is the dial-code table.
- **No flag sprite sheet, no icon font.** A flag emoji is six bytes of arithmetic.
- **E.164 in and out** — one canonical format, never the formatted display text.
- **As-you-type formatting that keeps your caret** where you left it, mid-string.
- **Native `<select>` and native `<input type="tel">`** — the platform's own picker on mobile,
  autofill, and keyboard type-ahead for free.
- **Zero runtime dependencies**, 4.1 kB brotli, no stylesheet to import.

## Basic use

```tsx
import { useState } from 'react'
import { PhoneInput } from '@rxova/react-phone-input'

function Signup() {
  const [phone, setPhone] = useState('')
  return <PhoneInput label="Phone number" value={phone} onChange={setPhone} defaultCountry="GB" />
}
```

`onChange` also receives the details:

```tsx
import { PhoneInput } from '@rxova/react-phone-input'

function Field() {
  return (
    <PhoneInput
      label="Phone"
      onChange={(value, details) => {
        // value    '+442071234567'
        // details  { e164, country: 'GB', national: '2071234567', possible: true }
        console.log(value, details)
      }}
    />
  )
}
```

## Possible, not valid

The claim this package makes is **possibility**, and the prop is named `possible` rather than
`valid` on purpose.

`libphonenumber` can tell you `+1 555 555 5555` is not an assignable US number, because it carries
the assignment rules for every carrier block in the world. That is what its metadata buys, and it
is genuinely worth its ~40 kB if you are validating a database of numbers.

This tells you the digits are a **length that country actually uses**, which is what a form field
needs to stop a typo — and it costs 4 kB. If you need real validity, validate on the server, where
the metadata is free and the answer can be trusted.

```ts
import { isPossible, countryByISO2, parsePhone } from '@rxova/react-phone-input'

parsePhone('+442071234567').possible // true  — 10 digits, which the UK uses
parsePhone('+4420712').possible // false — no UK number is 5 digits
parsePhone('+9912345678').possible // false — no such calling code
isPossible(countryByISO2('US'), '4155552671') // true
```

## Where the data comes from

| What                             | Source                                 | Cost                        |
| -------------------------------- | -------------------------------------- | --------------------------- |
| Country names                    | `Intl.DisplayNames`                    | 0 — every engine ships ICU  |
| Flags                            | Two Unicode regional-indicator letters | 0 — six bytes of arithmetic |
| Calling codes, lengths, grouping | This package's table                   | ~4 kB                       |

That is the whole trick. Bundled locale JSON in this space is mostly _names_, and the platform has
been giving those away since 2019.

```ts
import { countryName, flagEmoji } from '@rxova/react-phone-input'

countryName('DE', 'en') // 'Germany'
countryName('DE', 'fr') // 'Allemagne'
flagEmoji('DE') // '🇩🇪'
```

On Windows the flag renders as the two letters instead of a flag. That is a legible fallback, not
a broken image.

## Input the component accepts

Users paste all three of these, so all three work:

| Typed               | Read as                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------ |
| `+44 20 7123 4567`  | Explicit international. The calling code decides the country; `defaultCountry` is ignored. |
| `0044 20 7123 4567` | The `00` international prefix, treated identically.                                        |
| `020 7123 4567`     | National, against the selected country. The trunk `0` is dropped.                          |

`011` is also honoured as the international prefix when the selected country is in the NANP — but
_only_ there, because `011x` is a legitimate UK area code.

Non-Latin digits are normalised: Arabic-Indic, extended Arabic-Indic and full-width numerals all
work, so a user typing on their own keyboard layout is not silently ignored.

## Restricting the list

```tsx
import { PhoneInput } from '@rxova/react-phone-input'

function Field() {
  return <PhoneInput label="Phone" countries={['GB', 'IE', 'FR', 'DE', 'ES']} defaultCountry="GB" />
}
```

Order is preserved. Unknown codes are dropped and reported through `onWarn`; an entirely empty or
entirely unknown list falls back to the full table, because a picker with nothing in it is not a
usable field.

## Forms

With a `name`, the component emits a hidden input carrying the E.164 value, so a native form posts
the canonical number rather than the formatted display text:

```tsx
import { PhoneInput } from '@rxova/react-phone-input'

function Form() {
  return (
    <form action="/signup" method="post">
      <PhoneInput label="Phone" name="phone" defaultCountry="US" />
      <button type="submit">Sign up</button>
    </form>
  )
}
```

The visible box shows `415 555 2671`; the form receives `+14155552671`.

React Hook Form, Formik and the rest work through `value`/`onChange` as usual, and the `ref` lands
on the `<input>`, which is what `setFocus()` and focus-first-error patterns expect.

## Styling

There is no stylesheet to import.

| Property                  | Default    | Applies to                           |
| ------------------------- | ---------- | ------------------------------------ |
| `--rx-phone-gap`          | `0.375rem` | Space between the select and the box |
| `--rx-phone-select-width` | `9rem`     | Maximum width of the country select  |

### `data-*` attributes

These are **public API**, covered by semver.

| Attribute                        | On           | Meaning                          |
| -------------------------------- | ------------ | -------------------------------- |
| `data-rx-phone-root`             | wrapper      | Always present                   |
| `data-country`                   | wrapper      | ISO code of the resolved country |
| `data-possible`                  | wrapper      | The number is a possible length  |
| `data-invalid` / `data-disabled` | wrapper      | Mirrors the props                |
| `data-rx-phone-country`          | `<select>`   | The country picker               |
| `data-rx-phone-input`            | `<input>`    | The number field                 |
| `data-rx-phone-value`            | hidden input | The E.164 value a form posts     |

## Headless

`usePhoneInput` gives you the whole state machine with no markup — including the caret bookkeeping,
which is the part worth not rewriting.

```tsx
import { usePhoneInput } from '@rxova/react-phone-input'

function CustomField() {
  const field = usePhoneInput({ defaultCountry: 'GB' })

  return (
    <div onBlur={field.handleBlur}>
      <select
        value={field.country?.iso2}
        onChange={(event) => {
          field.selectCountry(event.target.value)
        }}
      >
        {field.countries.map((country) => (
          <option key={country.iso2} value={country.iso2}>
            {field.flagFor(country.iso2)} {field.nameFor(country.iso2)} +{country.dial}
          </option>
        ))}
      </select>
      <input
        ref={(node) => {
          field.inputRef.current = node
        }}
        type="tel"
        value={field.text}
        onChange={field.handleInputChange}
      />
    </div>
  )
}
```

The parsing helpers are exported too — `parsePhone`, `formatPhone`, `formatNational`, `isPossible`,
`digitsOnly`, `lengthsFor` — all pure and synchronous.

## Diagnostics

`onWarn` receives a `{ code, prop, received, message }` whenever a prop is rejected or coerced:

```tsx
import * as Sentry from '@sentry/react'
import { PhoneInput } from '@rxova/react-phone-input'

function Field() {
  return (
    <PhoneInput
      label="Phone"
      onWarn={(warning) => {
        Sentry.captureMessage(warning.message, { level: 'warning', extra: { ...warning } })
      }}
    />
  )
}
```

Codes: `unknown-country`, `unknown-default-country`, `value-not-e164`, `value-country-unknown`,
`empty-country-list`, `locale-invalid`.

With no handler these go to `console.warn`. **The entire path is stripped from production builds** —
it sits behind a `process.env.NODE_ENV !== 'production'` branch, so there is no runtime cost and no
console noise in production. The E2E suite asserts this against a real production bundle.

## Accessibility

- A real `<input type="tel">` with `inputmode="tel"` and `autocomplete="tel"`, beside a real
  `<select>`. `label` names it; supply your own `<label htmlFor={`${id}-input`}>` when the design
  wants visible text. Both are native controls on purpose: on a phone the select
  is the platform's own picker, already searchable and localised, which no custom listbox of 234
  options matches.
- The select carries an accessible name of its own (`countryLabel`), so it is not announced as an
  unlabelled combobox.
- Every option has a name — flag, country name and calling code — so keyboard type-ahead works and
  nothing is announced blank.
- The hidden E.164 field is `type="hidden"`, so it is never focusable and never announced; the
  visible controls are the accessible representation of the value.
- axe (WCAG 2.1 A/AA) runs over the component in the browser suite and over the whole demo page in
  Chromium, Firefox and WebKit.

## Part of rxova

Part of the [rxova headless React inputs](https://rxova.org/packages/react-inputs/overview) suite —
install the whole set from
[`@rxova/react-inputs`](https://www.npmjs.com/package/@rxova/react-inputs), or read the full
generated [API reference](https://rxova.org/packages/react-inputs/components/phone/api) for this package.

Cross-cutting guidance lives on this component's About page:
[styling](https://rxova.org/packages/react-inputs/components/phone/about/#styling) and [form libraries](https://rxova.org/packages/react-inputs/components/phone/about/#form-libraries). Coming from
another library? The [migration guide](https://rxova.org/packages/react-inputs/components/phone/migrating/) maps the props across.

## License

[MIT](https://github.com/rxova/react-inputs/blob/main/LICENSE) © rxova
