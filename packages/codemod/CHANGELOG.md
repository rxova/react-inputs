# @rxova/codemod

## 1.0.1

### Patch Changes

- [#70](https://github.com/rxova/react-inputs/pull/70) [`111bf02`](https://github.com/rxova/react-inputs/commit/111bf0202f3a8787eedea28b128fe33ed1e05ee0) - Broaden the npm keywords

  Adds `jscodeshift-transform`, `automated-migration`, `refactor`, `upgrade`, `ast`
  and `react`. A codemod is found by somebody who has decided to migrate and does
  not yet know a transform exists, so the registry is the only place that discovery
  can happen. No code changes.

## 1.0.0

### Major Changes

- [#63](https://github.com/rxova/react-inputs/pull/63) [`6aadf81`](https://github.com/rxova/react-inputs/commit/6aadf8109cf3ffdfecd6908daf7bdaee224b1a7a) - Release at `1.0.0`.

  No API changes and no new transforms — the version moves to put the package on the same number as
  the inputs it migrates. The suite's versions had drifted apart as an accident of merge order rather
  than as a statement about maturity, and a codemod claiming `0.2.0` while every package it rewrites
  claims `1.0.0` reads as the older, less finished half of a pair it is actually in step with.

## 0.2.0

### Minor Changes

- [#60](https://github.com/rxova/react-inputs/pull/60) [`4b038de`](https://github.com/rxova/react-inputs/commit/4b038ded8581e07bdbbb1c4eac116c95c08cfa49) - Add `currency-on-change` for the 1.0 handler swap in `@rxova/react-intl-currency-input`:
  `onValueChange` becomes `onChange`, and any native `onChange` becomes `onNativeChange`.

  Both renames are applied in a single pass over each element, which is the reason this is a codemod
  and not a documented find-and-replace — done sequentially, the value handler walks through both
  steps and silently ends up on the native prop. The component is resolved through its import, so an
  alias is followed and a same-named component from another library is left alone. `useCurrencyInput`
  options objects take the same rename.

## 0.1.3

### Patch Changes

- [#53](https://github.com/rxova/react-inputs/pull/53) [`8ee31e1`](https://github.com/rxova/react-inputs/commit/8ee31e1ce842c93c0e171a1926822695122a4fda) - Ship an `llms.txt` in the package. An agent asked to migrate off another OTP library should find the executable path rather than rewrite call sites by hand — and should know that unmapped imports are left in place with a `TODO`, so a green build does not mean the migration finished.

## 0.1.2

### Patch Changes

- [#13](https://github.com/rxova/react-inputs/pull/13) [`efc7bba`](https://github.com/rxova/react-inputs/commit/efc7bba37136fc1ec7e4dd5af0070870bc0d29ba) - Point the `input-otp-to-otp` banner and the README at the OTP migration guide's
  current URL. The old `/migrating/from-input-otp` route no longer exists, so the
  comment the codemod writes into migrated source led to a 404.

## 0.1.1

### Patch Changes

- [`f5dd58c`](https://github.com/rxova/react-inputs/commit/f5dd58c91d6aeef8cb7aa83d51e21a55f91326f9) Point the `input-otp-to-otp` banner at the live migration guide.

  When the transform meets a `render` prop it cannot rewrite, it inserts a comment pointing at the
  migration guide. That URL was `rxova.github.io/react-inputs/migrating/from-input-otp`, which is not
  served — so the codemod was writing a dead link into users' source files. It now points at
  `rxova.org/packages/react-inputs/migrating/from-input-otp`.

  Also adds the badge row and docs links the other packages already had to this package's README.
