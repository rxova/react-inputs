# @rxova/react-intl-currency-input

## 1.0.1

### Patch Changes

- [#70](https://github.com/rxova/react-inputs/pull/70) [`111bf02`](https://github.com/rxova/react-inputs/commit/111bf0202f3a8787eedea28b128fe33ed1e05ee0) - Broaden the npm keywords

  Adds `currency-input`, `money-input`, `price-input`, `amount` and `decimal` — the
  names the field goes by in a product spec — plus `intl-numberformat`, which is
  what it is actually built on, and `headless`/`accessible`/`a11y`, which the
  sibling packages already carried and this one did not. No code changes.

## 1.0.0

### Major Changes

- [#63](https://github.com/rxova/react-inputs/pull/63) [`6aadf81`](https://github.com/rxova/react-inputs/commit/6aadf8109cf3ffdfecd6908daf7bdaee224b1a7a) - Release at `1.0.0`.

  No API changes. The version moves from `0.3.0` so the package sits on the same number as its eight
  siblings, which had drifted apart as an accident of merge order rather than as a statement about
  maturity — this input took three `minor` bumps where a later-landing one took a single `major`, and
  `0.3.0` next to `1.0.0` implied a difference in maturity that does not exist.

  No migration is required.

## 0.3.0

### Minor Changes

- [#60](https://github.com/rxova/react-inputs/pull/60) [`4b038de`](https://github.com/rxova/react-inputs/commit/4b038ded8581e07bdbbb1c4eac116c95c08cfa49) - Add the `data-rx-currency-root` selector hook, so this component is reachable by the same
  convention as the other eight. It renders a single element, so the root _is_ the input — hence one
  attribute here where the composite components carry two. `data-invalid` is unchanged.

- [#60](https://github.com/rxova/react-inputs/pull/60) [`4b038de`](https://github.com/rxova/react-inputs/commit/4b038ded8581e07bdbbb1c4eac116c95c08cfa49) - Add `onValueChange` as a deprecated compatibility alias for the value-first `onChange` API introduced
  in 0.2.0. Both handlers fire when supplied, and development builds warn once so consumers can migrate
  incrementally with `npx @rxova/codemod currency-on-change`.

## 0.2.0

### Minor Changes

- [#55](https://github.com/rxova/react-inputs/pull/55) [`e7f4f90`](https://github.com/rxova/react-inputs/commit/e7f4f90477bfb27310102d2c9ab3d92c34a7c4b4) - **Breaking:** `onValueChange` is now `onChange`, and the native passthrough is now `onNativeChange`.

  The value handler had the wrong name. Every other input in the suite emits its value through
  `onChange`; this one made you learn a second name for the same idea, and reserved the obvious one
  for a DOM event most consumers never touched. That is now inverted: `onChange` gives you
  `(value: number | null, meta)`, and the raw `ChangeEvent` moved to `onNativeChange`.

  No deprecation window — pre-1.0, the old name is removed outright rather than carried along.
  TypeScript catches both halves: `onValueChange` no longer exists, and a `ChangeEventHandler` no
  longer fits `onChange`. Plain-JS consumers should search their source for `onValueChange`.

  There is no codemod for this rename — it is a manual edit. Rename both props in one pass, on
  `<CurrencyInput>` elements and `useCurrencyInput` options, imported from either
  `@rxova/react-intl-currency-input` or `@rxova/react-inputs`; renaming them sequentially would
  collapse `onValueChange` onto `onNativeChange` and lose the value handler.

## 0.1.6

### Patch Changes

- [#53](https://github.com/rxova/react-inputs/pull/53) [`8ee31e1`](https://github.com/rxova/react-inputs/commit/8ee31e1ce842c93c0e171a1926822695122a4fda) - Ship an `llms.txt` in the package. Coding agents read `node_modules` after an install, so this puts the install line, a working example and the full prop table where they will actually be found — including that the amount comes from `onValueChange` rather than `event.target.value` (which is localized), that an empty field is `null` and not `0`, and that the hook's `ref` is what keeps the caret in place in `'live'` mode.

## 0.1.5

### Patch Changes

- [#42](https://github.com/rxova/react-inputs/pull/42) [`8eb69b6`](https://github.com/rxova/react-inputs/commit/8eb69b6d122a6ae72699a16165c598789bb24625) - Live mode no longer lets an invalid keystroke disturb the field. An insertion that cannot contribute to the amount — a letter, a group separator, a second decimal separator — is rejected in `beforeinput`, so the value and the caret stay exactly where they were (a mid-string `,` used to reinterpret `1.234,56 €` as `12,34 €` and throw the caret to the end). Controlled hosts that echo `onValueChange` asynchronously (async stores, Storybook args) no longer clobber the field with stale text between the keystroke and the echo, which used to drop digits while typing and send the caret to the end.

## 0.1.4

### Patch Changes

- [#15](https://github.com/rxova/react-inputs/pull/15) [`7fc9910`](https://github.com/rxova/react-inputs/commit/7fc9910538a95983882f95324d7aaa2fdb75a7d9) - Declare the package in its own manifest (`rxova.slug`, `label`, `title`) so
  the docs sidebar, the CI matrices and the playground discover it instead of
  repeating it in a list each. No runtime change.

## 0.1.3

### Patch Changes

- [#13](https://github.com/rxova/react-inputs/pull/13) [`efc7bba`](https://github.com/rxova/react-inputs/commit/efc7bba37136fc1ec7e4dd5af0070870bc0d29ba) - Point the README and `homepage` at the routes the docs site actually serves.
  The Docusaurus-era `/packages/react-inputs/currency` landing route and the shared
  `/guides/*` pages were removed when the docs were restructured per component,
  so every documentation link on the npm page 404'd.

## 0.1.2

### Patch Changes

- [`52a71be`](https://github.com/rxova/react-inputs/commit/52a71be1cacad59dafff8b3951cbc15bf4b2fd88) - Add the currency input package logo and refresh the Rxova React Inputs documentation.

## 0.1.1

### Patch Changes

- [`f5dd58c`](https://github.com/rxova/react-inputs/commit/f5dd58c91d6aeef8cb7aa83d51e21a55f91326f9) Correct the published README and package metadata after the move into the rxova monorepo.

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
