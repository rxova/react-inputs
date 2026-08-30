# react-feedback-stars

## 1.0.1

### Patch Changes

- [#70](https://github.com/rxova/react-inputs/pull/70) [`111bf02`](https://github.com/rxova/react-inputs/commit/111bf0202f3a8787eedea28b128fe33ed1e05ee0) - Broaden the npm keywords

  Adds `rating-input`, `star-input`, `five-star` and `half-star` — including the
  fractional case, which is the reason to reach for this over a row of radios —
  plus `radiogroup` for the semantics it is built on and `survey` for where it
  tends to land. No code changes.

## 1.0.0

### Major Changes

- [#60](https://github.com/rxova/react-inputs/pull/60) [`4b038de`](https://github.com/rxova/react-inputs/commit/4b038ded8581e07bdbbb1c4eac116c95c08cfa49) - **Breaking:** every CSS custom property and `data-*` hook is now namespaced `--rx-rating-*` /
  `data-rx-rating-*`. `--rfs-size` becomes `--rx-rating-size`, `[data-rfs-root]` becomes
  `[data-rx-rating-root]`, and so on for all ten properties and three attributes. The shared state
  hooks — `data-state`, `data-fill`, `data-active`, `data-disabled`, `data-readonly`, `data-invalid`,
  `data-idx` — are unchanged.

  Run `npx @rxova/codemod rx-token-prefixes` over your components, and the `sed` line in the
  migration guide over your stylesheets.

  `--rfs-` was initials of a name this package no longer has (`react-feedback-stars`), which made it
  the one prefix in the suite a reader could not derive from the package they installed — and it sat
  one character from `--rfi-`, the file input's. `pnpm check:tokens` now enforces the scheme.

### Patch Changes

- [#60](https://github.com/rxova/react-inputs/pull/60) [`4b038de`](https://github.com/rxova/react-inputs/commit/4b038ded8581e07bdbbb1c4eac116c95c08cfa49) - Development warnings said `[react-feedback-stars]`, which is a package name this has not had since
  it was renamed. They now say `[react-rating-input]`, so a developer searching for the source of a
  console line finds the package they installed.

## 0.2.5

### Patch Changes

- [#53](https://github.com/rxova/react-inputs/pull/53) [`8ee31e1`](https://github.com/rxova/react-inputs/commit/8ee31e1ce842c93c0e171a1926822695122a4fda) - Ship an `llms.txt` in the package. Coding agents read `node_modules` after an install, so this puts the install line, a working example, the full prop table, the CSS custom properties and the `data-*` hooks where they will actually be found — including that omitting `onChange` is how you get a read-only score, and that `precision` is the grid the user's input snaps to, not a rounding rule applied to a value you supply.

## 0.2.4

### Patch Changes

- [#42](https://github.com/rxova/react-inputs/pull/42) [`8eb69b6`](https://github.com/rxova/react-inputs/commit/8eb69b6d122a6ae72699a16165c598789bb24625) - The pointer no longer flickers back to the default cursor in the gaps between icons: the interactive root now carries the same cursor as the per-step labels (`pointer`, or `not-allowed` when disabled). Read-only ratings are unchanged.

## 0.2.3

### Patch Changes

- [#15](https://github.com/rxova/react-inputs/pull/15) [`7fc9910`](https://github.com/rxova/react-inputs/commit/7fc9910538a95983882f95324d7aaa2fdb75a7d9) - Declare the package in its own manifest (`rxova.slug`, `label`, `title`) so
  the docs sidebar, the CI matrices and the playground discover it instead of
  repeating it in a list each. No runtime change.

## 0.2.2

### Patch Changes

- [#13](https://github.com/rxova/react-inputs/pull/13) [`efc7bba`](https://github.com/rxova/react-inputs/commit/efc7bba37136fc1ec7e4dd5af0070870bc0d29ba) - Point the README and `homepage` at the routes the docs site actually serves.
  The Docusaurus-era `/packages/react-inputs/rating` landing route and the shared
  `/guides/*` pages were removed when the docs were restructured per component,
  so every documentation link on the npm page 404'd.

## 0.2.1

### Patch Changes

- [`f5dd58c`](https://github.com/rxova/react-inputs/commit/f5dd58c91d6aeef8cb7aa83d51e21a55f91326f9) Thanks [@jonatankruszewski](https://github.com/jonatankruszewski)! - Correct the published README and package metadata after the move into the rxova monorepo.

  The README shown on npm is served from the published tarball, so these fixes required a release:

  - **Install commands and imports named the pre-migration packages.** The READMEs told users to
    install `react-feedback-stars`, `react-otp-slots` and `react-intl-currency-input`, and imported
    from those specifiers, none of which are the published names. They now use the `@rxova/*` names.
  - **Documentation links were dead.** Every `rxova.github.io/react-*` link, plus the `/recipes/*` and
    `/playground` routes, returned 404. They now point at the live docs on
    `rxova.org/packages/react-inputs`.
  - **CI badges pointed at the pre-migration repositories**, so they showed either a 404 image or the
    status of an archived repo. They now report this repository's CI.
  - **`homepage` in each manifest pointed at `rxova.github.io/react-inputs/…`**, which is not served —
    this is the "Homepage" link on the npm page. It now points at the live docs.
  - Added npm version badges, and documented each package's place in the suite.

  No runtime code changed in these packages; `dist` output is identical.

## 0.2.0

### Minor Changes

- [#11](https://github.com/rxova/react-feedback-stars/pull/11) [`6cdd572`](https://github.com/rxova/react-feedback-stars/commit/6cdd57242a2f855f70903c2290f2abc34e24f582) - Add development-only input diagnostics via a new `onWarn` prop.

  Out-of-range props were already coerced to keep the component functional — a `value` above `max`
  paints `max`, a negative or non-finite `value` becomes `0`, and an invalid `max` falls back to a
  positive integer — but that coercion was silent, so mistakes like `value={7}` on a 5-star widget
  went unnoticed. The component now surfaces each coercion in development with a structured
  `RatingWarning` (`{ code, prop, received, used, message }`). Pass `onWarn` to route these into your
  own logging, or leave it off for a deduped `console.warn`. The entire path is stripped from
  production builds, and the value is clamped either way, so behavior is unchanged there.

  Exports the `RatingWarning` and `RatingWarningCode` types.

  Also declares a `>=20.19.0` Node engines requirement to match the supported toolchain.

## 0.1.1

### Patch Changes

- [#7](https://github.com/rxova/react-feedback-stars/pull/7) [`cddcfd4`](https://github.com/rxova/react-feedback-stars/commit/cddcfd43f167b70cb98552d1f2900c72b745d924) Thanks [@jonatankruszewski](https://github.com/jonatankruszewski)! - Documentation and developer-experience release. The published package (`dist`) is unchanged from
  0.1.0 — this refreshes what ships alongside it on npm and the new docs site.

  - New documentation site (Docusaurus) with guides, live editable examples, generated
    screenshots/GIFs, and an API reference generated from source.
  - Migration guides from `react-rating`, `react-stars`, and hand-rolled radio widgets.
  - Copy-paste form recipes, now including **TanStack Form** as a tested integration alongside
    React Hook Form, Formik, and React Final Form.
  - README refresh: leads with the canonical positioning and links to the docs and live examples.
  - `homepage` now points to the documentation site (https://rxova.github.io/react-feedback-stars/) so
    npm and package managers link to the product surface; `repository` and `bugs` still point to GitHub.

## 0.1.0

### Minor Changes

- [`919abfa`](https://github.com/rxova/react-feedback-stars/commit/919abfa8ff2ad1fb8694c9ae7c48bf22f3114e1d) - First release. A headless, zero-dependency React rating component: bring your own
  icon, choose your own precision, accessible by construction.

  **Rendering**

  - Any `ReactNode` as an icon — inline SVG, emoji (including ZWJ sequences), or
    arbitrary JSX. A render function receives per-icon state for conditional icons.
  - Continuous partial fills. `4.3` renders a real 30% fifth icon, not a rounded one.
  - Right-to-left support: the fill origin flips via CSS logical properties.
  - Respects `prefers-reduced-motion`.

  **Rounding**

  Two orthogonal props rather than one overloaded mode: `precision` sets the grid
  (continuous, tenths, halves, whole) and `rounding` sets the direction
  (`nearest` / `down` / `up` / `none`). Out-of-range, `NaN` and `Infinity` values
  clamp instead of throwing — a display component should never crash a page over a
  data value. Snapping is display-only and never rounds a value back into your state.

  **Interaction and forms**

  - Read-only by default. Providing `onChange` upgrades it to a `radiogroup` of real
    radios, so keyboard navigation, focus and form participation come from the
    platform. `disabled` stays a disabled radiogroup rather than degrading to an
    image, so the field remains discoverable to screen readers.
  - One tab stop per rating, including when nothing is selected yet.
  - Keyboard: arrows, digit keys to jump, Backspace/Delete to clear.
  - `onBlur` fires when focus leaves the whole group, not while moving between
    icons, so validation doesn't fire mid-interaction. With `invalid`,
    `aria-describedby` and `name`, it drops into React Hook Form, Formik, React
    Final Form, or a plain `<form>`.

  **Styling**

  No stylesheet to import. Only layout-critical CSS is inlined; everything visual is
  a `--rfs-*` custom property or a `data-*` hook, both covered by semver.

  **Packaging**

  Zero runtime dependencies, `react >= 18` as the only peer, dual ESM/CJS with
  correct types in both, and `useRating` exported separately for fully custom
  renderers (~900 B on its own).
