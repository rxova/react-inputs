<p align="center">
  <a href="https://rxova.org/packages/react-inputs/">
    <img src="assets/logo.svg" width="112" alt="Rxova React Inputs logo" />
  </a>
</p>

<h1 align="center">Rxova React Inputs</h1>

<p align="center"><strong>Complex React inputs made simple. Headless, lightweight, accessible, tested E2E.</strong></p>

<p align="center">
  Thoughtful React components for polished input experiences, with flexible styling,<br />
  small bundles, and careful attention to interaction details.
</p>

<p align="center">
  <a href="https://github.com/rxova/react-inputs/actions/workflows/ci.yml"><img src="https://github.com/rxova/react-inputs/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI status" /></a>
  <a href="https://www.npmjs.com/package/@rxova/react-inputs"><img src="https://img.shields.io/npm/v/@rxova/react-inputs?color=cb3837&logo=npm&logoColor=white" alt="npm version" /></a>
  <img src="https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white" alt="TypeScript strict mode" />
  <img src="https://img.shields.io/badge/dependencies-0-44cc11" alt="Zero runtime dependencies" />
  <img src="https://img.shields.io/badge/React-%E2%89%A518-61dafb?logo=react&logoColor=white" alt="React 18 or newer" />
  <a href="https://github.com/rxova/react-inputs/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT license" /></a>
</p>

<p align="center">
  <a href="https://rxova.org/packages/react-inputs/"><strong>Documentation</strong></a> ·
  <a href="https://rxova.org/packages/react-inputs/getting-started/installation">Installation</a> ·
  <a href="https://rxova.org/packages/react-inputs/getting-started/quick-start">Quick start</a> ·
  <a href="https://rxova.org/packages/react-inputs/overview">Why Rxova React Inputs</a> ·
  <a href="CONTRIBUTING.md">Contributing</a>
</p>

---

Complex inputs deserve careful handling of formatting, interaction, accessibility and forms. Rxova
React Inputs brings those details together in focused components, helping you create a polished
experience while keeping control of markup and styling.

Every component follows the same principles: platform semantics, native form submission, a small
typed API and **no stylesheet to import**. The result is a suite that works with your design system
and gives you more time to focus on the experience you want to build.

## The suite

| Package                                                                                                                                                                                                                                       | What it does                                                                    | Brotli    |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | --------- |
| [**`@rxova/react-intl-currency-input`**](packages/react-intl-currency-input)<br />[![npm](https://img.shields.io/npm/v/@rxova/react-intl-currency-input?color=cb3837&label=)](https://www.npmjs.com/package/@rxova/react-intl-currency-input) | Locale-aware money entry with correct grouping, symbols and no cursor bugs      | ≤ 3.25 kB |
| [**`@rxova/react-rating-input`**](packages/react-rating-input)<br />[![npm](https://img.shields.io/npm/v/@rxova/react-rating-input?color=cb3837&label=)](https://www.npmjs.com/package/@rxova/react-rating-input)                             | Any icon, any precision, with `radiogroup` semantics and a read-only image mode | ≤ 3 kB    |
| [**`@rxova/react-otp-input`**](packages/react-otp-input)<br />[![npm](https://img.shields.io/npm/v/@rxova/react-otp-input?color=cb3837&label=)](https://www.npmjs.com/package/@rxova/react-otp-input)                                         | One-time-code entry with spatial slots, paste handling and WebOTP autofill      | ≤ 4.5 kB  |
| [**`@rxova/react-password-input`**](packages/react-password-input)<br />[![npm](https://img.shields.io/npm/v/@rxova/react-password-input?color=cb3837&label=)](https://www.npmjs.com/package/@rxova/react-password-input)                     | Reveal toggle, Caps Lock warning and a strength meter that costs 1 kB, not 400  | ≤ 5 kB    |
| [**`@rxova/react-phone-input`**](packages/react-phone-input)<br />[![npm](https://img.shields.io/npm/v/@rxova/react-phone-input?color=cb3837&label=)](https://www.npmjs.com/package/@rxova/react-phone-input)                                 | International numbers with no metadata blob — E.164 in and out                  | ≤ 4.25 kB |
| [**`@rxova/react-date-input`**](packages/react-date-input)<br />[![npm](https://img.shields.io/npm/v/@rxova/react-date-input?color=cb3837&label=)](https://www.npmjs.com/package/@rxova/react-date-input)                                     | Segmented, locale-ordered date entry with no calendar and no date library       | ≤ 4 kB    |
| [**`@rxova/react-time-input`**](packages/react-time-input)<br />[![npm](https://img.shields.io/npm/v/@rxova/react-time-input?color=cb3837&label=)](https://www.npmjs.com/package/@rxova/react-time-input)                                     | Segmented time entry, 12/24-hour by locale, canonical 24-hour value             | ≤ 4 kB    |
| [**`@rxova/react-tags-input`**](packages/react-tags-input)<br />[![npm](https://img.shields.io/npm/v/@rxova/react-tags-input?color=cb3837&label=)](https://www.npmjs.com/package/@rxova/react-tags-input)                                     | Tags and tokens with a real roving tab order and announced add/remove           | ≤ 4 kB    |
| [**`@rxova/react-file-input`**](packages/react-file-input)<br />[![npm](https://img.shields.io/npm/v/@rxova/react-file-input?color=cb3837&label=)](https://www.npmjs.com/package/@rxova/react-file-input)                                     | Picker and drop zone with accept/size rules, dedupe and managed previews        | ≤ 4 kB    |
| [**`@rxova/react-inputs`**](packages/react-inputs)<br />[![npm](https://img.shields.io/npm/v/@rxova/react-inputs?color=cb3837&label=)](https://www.npmjs.com/package/@rxova/react-inputs)                                                     | Meta-package — the whole suite from one install, tree-shaken to what you import | ≤ 10 kB   |
| [**`@rxova/codemod`**](packages/codemod)<br />[![npm](https://img.shields.io/npm/v/@rxova/codemod?color=cb3837&label=)](https://www.npmjs.com/package/@rxova/codemod)                                                                         | `jscodeshift` helpers for supported migration paths                             | —         |

## Installation

Install the whole suite from one package:

```bash
npm install @rxova/react-inputs
```

Or add only the components you use:

```bash
npm install @rxova/react-otp-input
```

The two are equivalent — the meta-package re-exports each component, and `sideEffects: false`
means your bundler drops whatever you don't import.

## Usage

```ts
import { CurrencyInput, Rating, OtpInput } from '@rxova/react-inputs'
// or
import { OtpInput } from '@rxova/react-otp-input'
```

Requires React 18 or 19. React is the shared peer dependency; the currency package also lists React
DOM as a peer. Each package includes dual ESM/CJS builds with types for both and is published with
npm provenance.

## Quick start

Components from Rxova React Inputs use controlled values: provide a value and a change handler, and
they fit naturally alongside your other form fields.

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

Each change handler receives the component's plain value rather than a synthetic event. Add `name`
when you want the value to submit natively from a plain `<form>`.

## Why Rxova React Inputs

- **Headless.** No stylesheet to import. Only layout-critical CSS is inlined; everything visual is
  a CSS custom property or a `data-*` hook, and those selectors are covered by semver.
- **Accessible by construction.** Native radios in a `radiogroup`, a single underlying `<input>`
  behind the OTP slots, and `role="img"` when read-only. Keyboard navigation, focus-visible, RTL and
  `prefers-reduced-motion` come from the platform, and every build is checked with
  `@axe-core/playwright`.
- **Lightweight.** There are no bundled runtime dependencies. React is a peer, and the currency
  package also peers React DOM. Each package carries a `size-limit` budget enforced on every pull
  request.
- **Designed for important details.** Locale-specific grouping, native digits, formatted paste,
  browser translation, IME, RTL and SSR/RSC are covered as part of the supported experience.
- **Typed, tested, documented.** TypeScript strict, 95% per-file coverage thresholds, unit plus
  browser plus Playwright E2E suites, and an API reference generated from source by TypeDoc so it
  stays aligned with the code.

## Documentation

Full guides, live editable examples and the generated API reference for Rxova React Inputs:
**[rxova.org/packages/react-inputs](https://rxova.org/packages/react-inputs/)**

| Component | Guide                                                                                        | API reference                                                          |
| --------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Currency  | [Getting started](https://rxova.org/packages/react-inputs/components/currency/introduction/) | [API](https://rxova.org/packages/react-inputs/components/currency/api) |
| Rating    | [Getting started](https://rxova.org/packages/react-inputs/components/rating/introduction/)   | [API](https://rxova.org/packages/react-inputs/components/rating/api)   |
| OTP       | [Getting started](https://rxova.org/packages/react-inputs/components/otp/introduction/)      | [API](https://rxova.org/packages/react-inputs/components/otp/api)      |
| Password  | [Getting started](https://rxova.org/packages/react-inputs/components/password/introduction/) | [API](https://rxova.org/packages/react-inputs/components/password/api) |
| Phone     | [Getting started](https://rxova.org/packages/react-inputs/components/phone/introduction/)    | [API](https://rxova.org/packages/react-inputs/components/phone/api)    |
| Date      | [Getting started](https://rxova.org/packages/react-inputs/components/date/introduction/)     | [API](https://rxova.org/packages/react-inputs/components/date/api)     |
| Time      | [Getting started](https://rxova.org/packages/react-inputs/components/time/introduction/)     | [API](https://rxova.org/packages/react-inputs/components/time/api)     |
| Tags      | [Getting started](https://rxova.org/packages/react-inputs/components/tags/introduction/)     | [API](https://rxova.org/packages/react-inputs/components/tags/api)     |
| File      | [Getting started](https://rxova.org/packages/react-inputs/components/file/introduction/)     | [API](https://rxova.org/packages/react-inputs/components/file/api)     |

Accessibility, styling and form-library guidance lives on each component's About page — for example
[Currency › About](https://rxova.org/packages/react-inputs/components/currency/about/).

## Migrating

Each component package includes migration guidance. Choose your component in the
[Rxova React Inputs documentation](https://rxova.org/packages/react-inputs/) to find its available
guides.

## Contributing

```bash
pnpm install
pnpm dev              # shared playground for the component suite
pnpm run docs         # docs site (use `pnpm run`: `docs` can shadow a pnpm builtin)
pnpm build            # turbo run build, cached
pnpm test             # unit + browser suites
pnpm typecheck
pnpm lint
pnpm exec changeset   # stage a release
```

Read [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow, commit conventions and the release gate,
and [RELEASING.md](RELEASING.md) for how versions are cut.

<details>
<summary><b>Repository layout &amp; tooling</b></summary>

```
packages/
  react-intl-currency-input   currency input
  react-rating-input          rating input
  react-otp-input             OTP input
  react-password-input        password input
  react-phone-input           international phone input
  react-date-input            segmented date input
  react-time-input            segmented time input
  react-tags-input            tags / token input
  react-file-input            file picker and drop zone
  react-inputs                meta-package, re-exports the suite
  codemod                     jscodeshift migration transforms
  demo-kit                    shared demo primitives (private, dev-only)
  utils                       release gate + repo checks (private)
apps/
  playground                  shared Vite playground
  docs                        Astro Starlight site, published as part of rxova.org
```

- **Turborepo** — task pipeline and caching (`turbo.json`)
- **pnpm** workspaces — security-hardened overrides plus release-age quarantine
- **tsdown** — dual ESM/CJS builds per package
- **Changesets** — versioning and publishing with npm provenance
- **Vitest** (unit + browser), **Playwright** e2e, **`@axe-core/playwright`** a11y,
  **size-limit** budgets, **publint** / **attw** export checks
- **ESLint** flat config (type-checked), **Prettier**, **commitlint** + **husky** + **lint-staged**
- `pnpm verify` runs the local release gate; `pnpm e2e` runs the whole-page suites with bounded
  concurrency. `pnpm check:docs` type-checks every snippet in this README and in each package
  README, so the examples above cannot rot.

</details>

## Community

- [Discussions](https://github.com/rxova/react-inputs/discussions) — questions, ideas, show and tell
- [Report a bug](https://github.com/rxova/react-inputs/issues/new?template=bug_report.yml) — please
  say which package it concerns and include a minimal reproduction
- [Security policy](SECURITY.md) · [Code of conduct](CODE_OF_CONDUCT.md) · [Support](SUPPORT.md)

## License

[MIT](LICENSE) © Rxova
