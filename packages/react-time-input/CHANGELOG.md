# @rxova/react-time-input

## 1.0.1

### Patch Changes

- [#65](https://github.com/rxova/react-inputs/pull/65) [`26f06a5`](https://github.com/rxova/react-inputs/commit/26f06a50a471dbb647c3411a5f289ed3797720c3) - Point `homepage` at the canonical documentation URL instead of the short route.

  `/packages/react-inputs/time` is not a dead link — `astro.config.mjs` emits a `/{slug}` redirect for every component, so it has always resolved. But it resolves through a meta-refresh stub, and it was only six of the nine: currency, OTP and rating already pointed straight at `/components/{slug}/introduction/`. Since `homepage` is what npm renders as the package page's home link, that click now lands on the destination rather than on a hop, and the field reads the same way across the suite.

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

- [#60](https://github.com/rxova/react-inputs/pull/60) [`4b038de`](https://github.com/rxova/react-inputs/commit/4b038ded8581e07bdbbb1c4eac116c95c08cfa49) - New package: a segmented, keyboard-first time field with no clock popup and no date library.

  12- or 24-hour, segment order, separators and the AM/PM words all come from `Intl`, so every locale
  is correct and the package still has zero runtime dependencies — 3.7 kB brotli, against 9.8 kB and
  seven dependencies for the nearest rival.

  The value is an `HH:mm[:ss]` string end to end, always 24-hour whatever the field displays, and no
  `Date` is ever constructed: a time of day is not an instant. Midnight is 12 AM and hour 0, noon is
  12 PM and hour 12, and the test suite sweeps all 24 hours rather than sampling, because that fold is
  wrong in exactly two of them.

  Full keyboard entry with auto-advance, arrow stepping, Home/End, Backspace and `a`/`p`; spinbutton
  semantics per segment with the day period announced as its localised word; optional seconds and
  minute/second steps that must divide 60; inclusive `min`/`max` that mark rather than discard an
  out-of-range time; and `onWarn` reporting rejected props, stripped entirely from production builds.

- [#60](https://github.com/rxova/react-inputs/pull/60) [`4b038de`](https://github.com/rxova/react-inputs/commit/4b038ded8581e07bdbbb1c4eac116c95c08cfa49) - Add `dir`.

  Segment order is decided by `Intl` from the `locale`, and writing direction is a separate question.
  Nothing else in the field changes, which the test pins by asserting the segment order is untouched.

### Patch Changes

- [#60](https://github.com/rxova/react-inputs/pull/60) [`4b038de`](https://github.com/rxova/react-inputs/commit/4b038ded8581e07bdbbb1c4eac116c95c08cfa49) - Clear a half-typed segment when a controlled value changes so the next keystroke starts from the
  time visible on screen. Remove the unused `snapToStep` internal export; typed values remain
  unchanged while step options continue to control arrow-key movement.
