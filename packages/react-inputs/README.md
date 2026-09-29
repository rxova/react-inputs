<p align="center">
  <a href="https://rxova.dev/packages/react-inputs/">
    <img src="https://raw.githubusercontent.com/rxova/react-inputs/main/apps/docs/static/img/logo.png" width="112" alt="rxova" />
  </a>
</p>

<h1 align="center">@rxova/react-inputs</h1>

<p align="center"><strong>The tricky React inputs, done right.</strong></p>

<p align="center">
  <a href="https://www.npmjs.com/package/@rxova/react-inputs"><img src="https://img.shields.io/npm/v/@rxova/react-inputs?color=cb3837&logo=npm&logoColor=white" alt="npm version" /></a>
  <a href="https://github.com/rxova/react-inputs/actions/workflows/ci.yml"><img src="https://github.com/rxova/react-inputs/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI status" /></a>
  <img src="https://img.shields.io/badge/brotli-%E2%89%A4%2010%20kB-6c5ce7" alt="Brotli size at most 10 kB for the whole suite" />
  <img src="https://img.shields.io/badge/coverage%20threshold-95%25-brightgreen" alt="Coverage threshold: 95% per file" />
  <img src="https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white" alt="TypeScript strict mode" />
  <img src="https://img.shields.io/badge/dependencies-0-44cc11" alt="Zero runtime dependencies" />
  <img src="https://img.shields.io/badge/React-%E2%89%A518-61dafb?logo=react&logoColor=white" alt="React 18 or newer" />
  <a href="https://github.com/rxova/react-inputs/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT license" /></a>
</p>

<p align="center">
  <a href="https://rxova.dev/packages/react-inputs/"><strong>Documentation</strong></a> ·
  <a href="https://rxova.dev/packages/react-inputs/getting-started/quick-start">Quick start</a> ·
  <a href="https://rxova.dev/packages/react-inputs/overview">Why rxova</a>
</p>

The complete [rxova](https://github.com/rxova/react-inputs) suite of headless, accessible React
input components, from a single install.

```bash
npm install @rxova/react-inputs
```

```tsx
import { useState } from 'react'
import { CurrencyInput, Rating, OtpInput } from '@rxova/react-inputs'

function Checkout() {
  const [price, setPrice] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const [code, setCode] = useState('')

  return (
    <>
      <CurrencyInput locale="en-US" currency="USD" value={price} onChange={setPrice} />
      <Rating value={score} onChange={setScore} precision={0.5} label="Rate your meal" />
      <OtpInput length={6} value={code} onChange={setCode} label="One-time code" />
    </>
  )
}
```

## What's inside

This is a meta-package that re-exports the individual components. Because every package is
`sideEffects: false`, your bundler drops whatever you don't import — a single-component import from
here costs the same as installing that package directly.

| Exports                                                                       | Package                                                                                              | Docs                                                                                  |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `CurrencyInput`, `useCurrencyInput`, `currencyForCountry`                     | [`@rxova/react-intl-currency-input`](https://www.npmjs.com/package/@rxova/react-intl-currency-input) | [Currency](https://rxova.dev/packages/react-inputs/components/currency/introduction/) |
| `Rating`, `useRating`                                                         | [`@rxova/react-rating-input`](https://www.npmjs.com/package/@rxova/react-rating-input)               | [Rating](https://rxova.dev/packages/react-inputs/components/rating/introduction/)     |
| `OtpInput`, `OtpGroup`, `OtpSlot`, `OtpSeparator`, `useOtpInput`, `useWebOTP` | [`@rxova/react-otp-input`](https://www.npmjs.com/package/@rxova/react-otp-input)                     | [OTP](https://rxova.dev/packages/react-inputs/components/otp/introduction/)           |

Prefer the narrowest dependency surface? Install the standalone packages instead — the import paths
are otherwise identical.

**Requires** React 18 or 19 — the only peer dependency (currency also peers `react-dom`). Dual
ESM/CJS builds with types for both, published with npm provenance.

## Documentation

Guides, live editable examples and the generated API reference live at
**[rxova.dev/packages/react-inputs](https://rxova.dev/packages/react-inputs/)** —
accessibility, styling and form-library guidance sit on each component's About page, for example
[Currency › About](https://rxova.dev/packages/react-inputs/components/currency/about/).

## License

[MIT](https://github.com/rxova/react-inputs/blob/main/LICENSE) © rxova
