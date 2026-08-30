# @rxova/react-date-input

## 1.0.2

### Patch Changes

- [#70](https://github.com/rxova/react-inputs/pull/70) [`111bf02`](https://github.com/rxova/react-inputs/commit/111bf0202f3a8787eedea28b128fe33ed1e05ee0) - Broaden the npm keywords

  Adds `date-field`, `date-entry`, `iso-date` and `locale-order`, plus
  `calendar-free` and `no-date-library` — someone reaching for a date input usually
  does not want a date picker or a 70 kB date library, and had no way to say so to
  the registry. No code changes.

## 1.0.1

### Patch Changes

- [#65](https://github.com/rxova/react-inputs/pull/65) [`26f06a5`](https://github.com/rxova/react-inputs/commit/26f06a50a471dbb647c3411a5f289ed3797720c3) - Point `homepage` at the canonical documentation URL instead of the short route.

  `/packages/react-inputs/date` is not a dead link — `astro.config.mjs` emits a `/{slug}` redirect for every component, so it has always resolved. But it resolves through a meta-refresh stub, and it was only six of the nine: currency, OTP and rating already pointed straight at `/components/{slug}/introduction/`. Since `homepage` is what npm renders as the package page's home link, that click now lands on the destination rather than on a hop, and the field reads the same way across the suite.

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

- [#60](https://github.com/rxova/react-inputs/pull/60) [`4b038de`](https://github.com/rxova/react-inputs/commit/4b038ded8581e07bdbbb1c4eac116c95c08cfa49) - Add `dir`.

  Segment order is decided by `Intl` from the `locale`, and writing direction is a separate question:
  a Hebrew page showing an en-GB date still wants day, month, year — laid out right to left. Nothing
  else in the field changes, which the test pins by asserting the segment order is untouched.

- [#60](https://github.com/rxova/react-inputs/pull/60) [`4b038de`](https://github.com/rxova/react-inputs/commit/4b038ded8581e07bdbbb1c4eac116c95c08cfa49) - New package: a segmented, keyboard-first date field with no calendar and no date library.

  Segment order, separators and month names come from `Intl`, so every locale is correct and the
  package still has zero runtime dependencies. The value is a `YYYY-MM-DD` string end to end and no
  `Date` is ever constructed, which removes the off-by-one that follows from modelling a calendar
  date as an instant.

  Full keyboard entry with auto-advance, arrow stepping, Home/End and Backspace; `spinbutton`
  semantics per segment with bounds that narrow as the date fills in and the month announced by name;
  inclusive `min`/`max` that mark rather than discard an out-of-range date; and `onWarn` reporting
  rejected props, stripped entirely from production builds.

### Patch Changes

- [#60](https://github.com/rxova/react-inputs/pull/60) [`4b038de`](https://github.com/rxova/react-inputs/commit/4b038ded8581e07bdbbb1c4eac116c95c08cfa49) - Clear a half-typed segment when a controlled value changes so the next keystroke starts from the
  date visible on screen.
