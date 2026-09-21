# Security Policy

Please report security issues privately. This policy covers every package published from this
monorepo (the `@rxova/*` inputs suite).

## Supported Versions

Security fixes land on the latest minor of each package's current major line.

| Version | Supported                         |
| ------- | --------------------------------- |
| `0.x`   | Yes — latest minor receives fixes |
| `< 0.1` | No                                |

Once a package ships `1.0.0`, this table is updated and its pre-1.0 versions stop receiving fixes.

## Response Targets

This is a volunteer-maintained project, so these are goals rather than contractual guarantees:

- Acknowledgement within 5 business days.
- An initial assessment, including whether the report is accepted, within 10 business days.
- Fixes for accepted high-severity reports released as soon as practical, coordinated with the
  reporter before public disclosure.

## How To Report

Use one of the following:

- [GitHub Security Advisory form](https://github.com/rxova/react-inputs/security/advisories/new)
- Email the maintainer if the advisory form is unavailable.

Include:

- affected package and version
- minimal reproduction
- impact assessment

Public disclosure should happen after a fix is available.

## Threat Model

Every component in this suite is a **rendering component with no runtime dependencies**, no network
access, no storage access, and no `eval`/`Function` construction. Realistic exposure is narrow, and
it is worth being explicit about where it does and does not exist.

**Consumer-controlled input that reaches the DOM:**

- Props that accept a `ReactNode` (icons, separators, rendered slots, labels) are escaped by React
  when passed a string. Passing untrusted **markup** is not safe — that is true of any React prop.
  Do not build a rendered node with `dangerouslySetInnerHTML` from user input.
- Accessible names (`label`, `formatLabel`, and similar) are set through React props and escaped.
- Numeric props (`value`, `max`, `precision`, slot counts) are clamped to safe ranges rather than
  thrown, so hostile numeric input degrades to a boundary value instead of crashing the page or
  producing an unbounded loop.

**Not applicable:** these packages do not read or write cookies, `localStorage`, or the network;
they do not register global listeners outside their own subtree. Where a component uses a browser
API (e.g. `matchMedia`, or the WebOTP `OTPCredential` API in `@rxova/react-otp-input`), the
listener is scoped and removed on unmount, and the capability degrades gracefully when unavailable.

**Content Security Policy:** the components set inline `style` attributes on the elements they
render. Under a strict CSP this requires `style-src` to permit inline styles (via a nonce, hash,
or `'unsafe-inline'`). It does **not** require `script-src 'unsafe-inline'` or `'unsafe-eval'`. If
your policy forbids inline styles entirely, please open an issue — a class-based rendering mode is
a plausible future option.

## Supply Chain

- Zero runtime dependencies; `react` is the only peer dependency (with `react-dom` where a
  package needs it).
- Releases publish from CI with [npm provenance](https://docs.npmjs.com/generating-provenance-statements)
  via OIDC trusted publishing, so there is no long-lived npm token to leak.
- `pnpm audit --audit-level=high` runs in CI and gates both pull requests and the release path.
- CodeQL analysis runs via GitHub's default code-scanning setup.
- Dependency updates arrive through Renovate and go through the same CI gate.
- A `minimumReleaseAge` quarantine in `pnpm-workspace.yaml` holds back freshly published
  dependency versions until they have aged, reducing exposure to compromised releases.
