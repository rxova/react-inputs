<p align="center">
  <img src="./assets/logo.svg" alt="@rxova/react-intl-currency-input logo" width="180" />
</p>

<h1 align="center">@rxova/react-intl-currency-input</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/@rxova/react-intl-currency-input"><img src="https://img.shields.io/npm/v/@rxova/react-intl-currency-input?color=cb3837&logo=npm&logoColor=white" alt="npm version" /></a>
  <a href="https://github.com/rxova/react-inputs/actions/workflows/ci.yml"><img src="https://github.com/rxova/react-inputs/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI status" /></a>
  <img src="https://img.shields.io/badge/brotli-%E2%89%A4%203.25%20kB-blue" alt="Brotli size at most 3.25 kB" />
  <img src="https://img.shields.io/badge/coverage%20threshold-95%25-brightgreen" alt="Coverage threshold: 95% per file" />
  <img src="https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white" alt="TypeScript strict mode" />
  <img src="https://img.shields.io/badge/dependencies-0-44cc11" alt="Zero runtime dependencies" />
  <img src="https://img.shields.io/badge/React-%E2%89%A518-61dafb?logo=react&logoColor=white" alt="React 18 or newer" />
  <a href="https://github.com/rxova/react-inputs/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT license" /></a>
</p>

**Localized currency input for React.** Zero dependencies, no cursor bugs, and correct in every
`Intl` locale — including the ones other libraries get wrong.

```bash
npm install @rxova/react-intl-currency-input
```

Requires React and React DOM 18 or newer. Both are peer dependencies; there are no bundled runtime
dependencies and no stylesheet to import.

📖 **[Documentation & live examples →](https://rxova.org/packages/react-inputs/components/currency/introduction/)** — the
locale matrix, formatting options, form recipes, and migration, with live editable examples you can
change in the browser: locales, currencies, precision, digits, negatives and keyboard stepping.

- **`Intl` owns the formatting** — group separator, decimal separator, symbol placement, fraction
  digits, and grouping rules are all read from `Intl.NumberFormat`, never reconstructed
- **No cursor bugs** — formats as you type with the caret anchored to the digit you typed, so it
  never jumps (or opt into `formatMode="blur"` for the simplest possible field)
- **Number in, number out** — your value is a `number`, not a formatted string to parse back
- **Useful input controls** — opt-in ArrowUp/ArrowDown stepping and raw-input transformation
- **Correct where others break** — bg-BG's "space only above 9999", fr-FR's narrow no-break space,
  ja-JP's zero decimals, KWD's three, ar-EG's native digits, hi-IN's lakh grouping, de-CH's apostrophe
- **Zero runtime dependencies**, ~3.2 kB brotli, no stylesheet to import
- **Form-ready** — first-class React Hook Form / Formik / React Final Form / TanStack Form recipes

## One value, eight languages

The same `1234567.89`, formatted by the same code. The language decides the separators, symbol side
and digits; the currency decides the fraction count. None of these is a special case.

<p align="center">
  <img src="./assets/examples/matrix.png" alt="1234567.89 formatted in Bulgarian, German, French, Japanese, Egyptian and Kuwaiti Arabic, Hindi and Swiss German" width="440" />
</p>

### The Bulgarian quirk, live

`5000` has no group separator; the moment the value crosses 10000 a (non-breaking) space appears —
straight from CLDR, no branch in our code.

<p align="center">
  <img src="./assets/examples/bulgarian.gif" alt="Typing in a Bulgarian field: 5000 stays 5000, 50000 becomes 50 000" width="360" />
</p>

### Same currency, nine languages

One US-dollar amount, rendered for nine locales — watch the symbol jump sides and the grouping change
(including Indian lakh grouping on `$12,34,567.5`).

<p align="center">
  <img src="./assets/examples/same-currency.png" alt="US$ 1,234,567.50 formatted in nine languages" width="440" />
</p>

## Quick start

```tsx
import { useState } from 'react'
import { CurrencyInput } from '@rxova/react-intl-currency-input'

function Price() {
  const [value, setValue] = useState<number | null>(50000)
  return <CurrencyInput locale="bg-BG" currency="EUR" value={value} onChange={setValue} />
}
```

`5000` stays `5000 €`, but `50000` becomes `50 000 €` — the Bulgarian rule that only groups above
9999, applied for free because `Intl` owns the formatting.

## How it works

An HTML `<input>` has no `type="currency"`. Rolling your own means handling a different group
separator, decimal separator, symbol position, and fraction-digit count for every locale — and
keeping the caret from jumping as separators appear while typing.

This library solves both:

- Every locale fact is read from `Intl.NumberFormat`, never reconstructed, so the tricky locales are
  correct by construction, not special-cased.
- By default it **formats as you type** (`formatMode="live"`) and keeps the caret in place by
  anchoring it to the digit you typed rather than the character position — the group separators that
  come and go never move it.

Prefer the simplest possible field? `formatMode="blur"` shows a plain number while focused and formats
only on blur, with no caret management at all.

## API

### `<CurrencyInput>`

| Prop                    | Type                                             | Default          | Notes                                                    |
| ----------------------- | ------------------------------------------------ | ---------------- | -------------------------------------------------------- |
| `locale`                | `string`                                         | runtime default  | BCP-47, e.g. `'bg-BG'`. Wins over `language`/`country`.  |
| `language` + `country`  | `string`                                         | —                | Combined into `${language}-${country}` when no `locale`. |
| `currency`              | `string` (required)                              | —                | ISO-4217, e.g. `'EUR'`.                                  |
| `value`                 | `number \| null`                                 | —                | Controlled. `null` renders an empty field.               |
| `defaultValue`          | `number \| null`                                 | `null`           | Uncontrolled initial value.                              |
| `onChange`              | `(value, meta) => void`                          | —                | `value` is a `number \| null`, not a DOM event.          |
| `onValueChange`         | `(value, meta) => void`                          | —                | Deprecated alias for `onChange`.                         |
| `onNativeChange`        | `ChangeEventHandler<HTMLInputElement>`           | —                | Forwarded DOM handler; runs after the internal one.      |
| `maximumFractionDigits` | `number`                                         | currency default | JPY 0, EUR 2, KWD 3.                                     |
| `minimumFractionDigits` | `number`                                         | `0`              | Set to `2` to force trailing zeros.                      |
| `currencyDisplay`       | `'symbol' \| 'narrowSymbol' \| 'code' \| 'name'` | `'symbol'`       | Passed to `Intl`.                                        |
| `numberingSystem`       | `string`                                         | locale default   | e.g. `'latn'` to force ASCII digits.                     |
| `allowNegative`         | `boolean`                                        | `false`          | Enables refunds / adjustments.                           |
| `formatMode`            | `'live' \| 'blur'`                               | `'live'`         | `'live'` formats as you type; `'blur'` on blur only.     |
| `step`                  | `number`                                         | —                | ArrowUp/ArrowDown increment.                             |
| `transformRawValue`     | `(raw: string) => string`                        | —                | Runs before locale-aware sanitization.                   |
| `invalid`               | `boolean`                                        | —                | Sets `aria-invalid` + `data-invalid`.                    |

All other props (`id`, `name`, `className`, `style`, `aria-*`, event handlers) forward to the
underlying `<input>`. `ref` forwards to the input.

## Styling

The package renders a native `<input>` and ships no stylesheet. Style it with `className`, `style`,
CSS Modules, CSS-in-JS, or utility classes. The `invalid` prop supplies both the accessible
`aria-invalid` state and a `[data-invalid]` selector:

```tsx
<CurrencyInput className="money-input" locale="bg-BG" currency="EUR" invalid={hasError} />
```

```css
.money-input {
  inline-size: 100%;
  padding: 0.625rem 0.75rem;
  border: 1px solid #94a3b8;
  border-radius: 0.5rem;
  font: inherit;
  font-variant-numeric: tabular-nums;
  text-align: end;
}

.money-input:focus-visible {
  border-color: #2563eb;
  outline: 3px solid rgb(37 99 235 / 25%);
}

.money-input[data-invalid] {
  border-color: #b42318;
}
```

### `data-*` attributes

These are **public API**, covered by semver. This component renders a single element, so the root
_is_ the input — hence one selector hook where the composite inputs in the suite carry several.

| Attribute               | On        | Meaning                    |
| ----------------------- | --------- | -------------------------- |
| `data-rx-currency-root` | `<input>` | Always present             |
| `data-invalid`          | `<input>` | Mirrors the `invalid` prop |

It defines no CSS custom properties: there is nothing painted on top of the input to configure, so
`className` and ordinary CSS reach everything.

See the **[complete styling guide](https://rxova.org/packages/react-inputs/components/currency/about/#styling)**
for labeled fields, CSS Modules, Tailwind, wrapper adornments, design-system variants, and RTL-safe
layout.

### `useCurrencyInput(options)`

The headless core. Returns `{ inputProps, value, display, focused, setValue, format, parse, … }` —
spread `inputProps` onto your own `<input>`.

```tsx
import { useState } from 'react'
import { TextField } from '@mui/material'
import { useCurrencyInput } from '@rxova/react-intl-currency-input'

function MuiPrice() {
  const [value, setValue] = useState<number | null>(null)
  const currency = useCurrencyInput({
    locale: 'de-DE',
    currency: 'EUR',
    value,
    onChange: setValue,
  })
  const { inputMode, ...textFieldProps } = currency.inputProps

  return <TextField {...textFieldProps} label="Price" slotProps={{ htmlInput: { inputMode } }} />
}
```

See the **[styling guide](https://rxova.org/packages/react-inputs/components/currency/about/#styling)** for shadcn/ui,
Radix Themes, MUI, Chakra UI, Mantine and Ant Design.

### `currencyForCountry(code)`

Best-effort ISO-3166 → ISO-4217 lookup for convenience. Prefer passing `currency` explicitly.

## Forms

`onChange` emits a `number`, so use a controlled adapter (RHF `Controller`, Formik `useField`,
etc.). See the
[form-library guide](https://rxova.org/packages/react-inputs/components/currency/about/#form-libraries)
for React Hook Form, Formik, React Final Form and TanStack Form.

## UI-library recipes

The docs contain maintained examples for shadcn/ui, Radix Themes, Material UI, Chakra UI, Mantine
and Ant Design. Copy a ready-labelled wrapper with:

```bash
npx shadcn@latest add https://rxova.org/packages/react-inputs/r/currency-field.json
```

[Open the recipes](https://rxova.org/packages/react-inputs/components/currency/about/#ui-library-recipes).

## Part of rxova

Part of the [rxova headless React inputs](https://rxova.org/packages/react-inputs/overview) suite —
install the whole set from
[`@rxova/react-inputs`](https://www.npmjs.com/package/@rxova/react-inputs), or read the full
generated [API reference](https://rxova.org/packages/react-inputs/components/currency/api) for this
package.

## License

[MIT](https://github.com/rxova/react-inputs/blob/main/LICENSE) © rxova
