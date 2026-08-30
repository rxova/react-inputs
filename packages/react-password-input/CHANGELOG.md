# @rxova/react-password-input

## 1.0.2

### Patch Changes

- [#70](https://github.com/rxova/react-inputs/pull/70) [`111bf02`](https://github.com/rxova/react-inputs/commit/111bf0202f3a8787eedea28b128fe33ed1e05ee0) - Broaden the npm keywords

  Adds `password-field`, `reveal-password`, `password-meter`, `new-password` and
  `autocomplete`, plus `zxcvbn-free` — the strength meter here costs about 1 kB
  rather than 400, and the package people are trying to avoid is the one they will
  have searched for first. No code changes.

## 1.0.1

### Patch Changes

- [#65](https://github.com/rxova/react-inputs/pull/65) [`26f06a5`](https://github.com/rxova/react-inputs/commit/26f06a50a471dbb647c3411a5f289ed3797720c3) - Point `homepage` at the canonical documentation URL instead of the short route.

  `/packages/react-inputs/password` is not a dead link — `astro.config.mjs` emits a `/{slug}` redirect for every component, so it has always resolved. But it resolves through a meta-refresh stub, and it was only six of the nine: currency, OTP and rating already pointed straight at `/components/{slug}/introduction/`. Since `homepage` is what npm renders as the package page's home link, that click now lands on the destination rather than on a hop, and the field reads the same way across the suite.

## 1.0.0

### Major Changes

- [#63](https://github.com/rxova/react-inputs/pull/63) [`6aadf81`](https://github.com/rxova/react-inputs/commit/6aadf8109cf3ffdfecd6908daf7bdaee224b1a7a) - Release at `1.0.0`.

  This is the first version of the package that anyone can install. `0.1.0` was versioned and its
  notes written, but the release run that would have published it failed before it reached npm, so
  the number never existed as far as consumers are concerned.

  `1.0.0` also puts the package on the same number as the rest of the suite, which had drifted apart
  as an accident of merge order rather than as a statement about maturity. Nothing here changes an
  API; the entire surface is the one described in the `0.1.0` notes below.

## 0.1.0

### Minor Changes

- [#60](https://github.com/rxova/react-inputs/pull/60) [`4b038de`](https://github.com/rxova/react-inputs/commit/4b038ded8581e07bdbbb1c4eac116c95c08cfa49) - Add `autoFocus` and `aria-label`, emit `data-readonly`, and expose `clear()` from the hook — the
  four places this package differed from its siblings for no reason anyone chose.

  `aria-label` matters more than it used to: `label` no longer renders an element, so a field with a
  visible label supplied by the page had no way to carry a _different_ announced name. It wins over
  `label` when both are given.

- [#60](https://github.com/rxova/react-inputs/pull/60) [`4b038de`](https://github.com/rxova/react-inputs/commit/4b038ded8581e07bdbbb1c4eac116c95c08cfa49) - Always cap the password field's length. `maxLength` now defaults to 128 rather than being left
  unset, because an unbounded field lets a single paste drive unbounded estimator work on every
  keystroke and unbounded KDF work at whatever the form posts to. NIST SP 800-63B requires accepting
  at least 64 characters and says nothing about accepting unlimited ones, so the default clears that
  floor twice over and stays well past the longest passphrase anyone types.

  The prop now only moves the cap; it can no longer remove it. A `maxLength` below `minLength` is
  still unsatisfiable, but it now falls back to the default instead of dropping the bound, and the
  accompanying warning says which value was used rather than claiming the prop was ignored. A
  non-finite `maxLength` is rejected for the same reason — `Infinity >= minLength` is true, so it
  previously passed the satisfiability check and restored the unbounded field.

  Consumers relying on the field accepting arbitrarily long input should pass an explicit
  `maxLength`.

- [#60](https://github.com/rxova/react-inputs/pull/60) [`4b038de`](https://github.com/rxova/react-inputs/commit/4b038ded8581e07bdbbb1c4eac116c95c08cfa49) - New package: a headless, zero-dependency password input.

  A reveal toggle that keeps focus and the caret where they were, a Caps Lock warning read off the
  real modifier state, a 1.2 kB entropy estimator (swap in zxcvbn with the `estimate` prop if you
  want its wordlists), a NIST SP 800-63B-aligned requirement checklist, and an optional debounced,
  abortable breach check that the library never calls the network for itself.

  `onWarn` reports coerced or dangerous configuration — a `maxLength` below `minLength`, an
  `autocomplete` that breaks password managers — and the whole diagnostics path is stripped from
  production builds.

### Patch Changes

- [#60](https://github.com/rxova/react-inputs/pull/60) [`4b038de`](https://github.com/rxova/react-inputs/commit/4b038ded8581e07bdbbb1c4eac116c95c08cfa49) - Fire `onBlur` when focus leaves from the reveal toggle.

  The handler was attached to the `<input>`, so it only ever saw focus leaving the input. Tabbing
  out of the field from the toggle — the ordinary way out, since the toggle is the last thing in the
  field — fired nothing at all: no `onBlur` for the form library, and no re-mask for `hideOnBlur`.

  It now sits on the element containing both, where `focusout` bubbles to. The containment check that
  keeps focus moving _within_ the field silent is unchanged.

  This is the bug that surfaced the moment the package got the `onBlur` test its five siblings
  already had. It had shipped unreported because nothing asserted the claim its own types made.

- [#60](https://github.com/rxova/react-inputs/pull/60) [`4b038de`](https://github.com/rxova/react-inputs/commit/4b038ded8581e07bdbbb1c4eac116c95c08cfa49) - Report a second, different misconfiguration of the same prop.

  `PasswordWarning` was the only warning type in the suite with no `received` field, so warnings could
  only be deduplicated by `code`. A component rendered with `minLength={-1}` and later `minLength={-5}`
  warned once and swallowed the second — the case a developer most needs told about, since it means
  the value they just changed is still wrong.

  `received` is now carried by every inspector and the dedupe key is `code:received`, matching
  `useDateInput` and the rest. Adding a field to a development-only diagnostic object is a patch: the
  type is emitted, never accepted, and the whole path is stripped from production builds.
