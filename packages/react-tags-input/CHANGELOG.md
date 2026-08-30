# @rxova/react-tags-input

## 1.0.2

### Patch Changes

- [#70](https://github.com/rxova/react-inputs/pull/70) [`111bf02`](https://github.com/rxova/react-inputs/commit/111bf0202f3a8787eedea28b128fe33ed1e05ee0) - Broaden the npm keywords

  Adds `tags-input`, `chips-input`, `token-input` and `multi-select` — four names
  for the same control, and the package was listed under the noun rather than any
  of them — plus `roving-tabindex`, which is the part that is hard and the reason
  to take this rather than write it. No code changes.

## 1.0.1

### Patch Changes

- [#65](https://github.com/rxova/react-inputs/pull/65) [`26f06a5`](https://github.com/rxova/react-inputs/commit/26f06a50a471dbb647c3411a5f289ed3797720c3) - Point `homepage` at the canonical documentation URL instead of the short route.

  `/packages/react-inputs/tags` is not a dead link — `astro.config.mjs` emits a `/{slug}` redirect for every component, so it has always resolved. But it resolves through a meta-refresh stub, and it was only six of the nine: currency, OTP and rating already pointed straight at `/components/{slug}/introduction/`. Since `homepage` is what npm renders as the package page's home link, that click now lands on the destination rather than on a hop, and the field reads the same way across the suite.

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

- [#60](https://github.com/rxova/react-inputs/pull/60) [`4b038de`](https://github.com/rxova/react-inputs/commit/4b038ded8581e07bdbbb1c4eac116c95c08cfa49) - New package: a tag input where the keyboard actually works.

  Not the smallest option in this category — `react-tagsinput` is 3.1 kB against this package's
  3.6 kB, and the manifest says so plainly. The case is six accessibility failures that are present
  in the most-downloaded alternatives and each of which has a test here:

  - focus after a removal never lands on `<body>`; it moves to the next tag, the previous, or the
    entry box
  - a roving tabindex gives the whole list one tab stop rather than one per tag
  - Backspace from an empty box takes two presses, so the user sees what they are about to delete
  - every remove button is named after its own tag rather than "Remove"
  - additions and removals are announced politely, with a pasted batch announced once
  - no `role="combobox"` without a popup to back it up

  Plus configurable delimiters, paste splitting on delimiters and newlines, case-insensitive dedupe,
  `max`, length bounds in codepoints, contained `transform`/`validate`, one hidden input per tag so a
  native form posts an array, and `onWarn` with seven codes stripped from production builds.

- [#60](https://github.com/rxova/react-inputs/pull/60) [`4b038de`](https://github.com/rxova/react-inputs/commit/4b038ded8581e07bdbbb1c4eac116c95c08cfa49) - Add `dir`, `autoFocus` and `aria-label`, and expose `clear()` from the hook.

  `clear()` empties the tags **and** the entry box. Half-clearing is the bug it exists to avoid: a
  form reset that leaves a half-typed tag behind still submits it on the next blur, because
  `addOnBlur` defaults to `true`.

### Patch Changes

- [#60](https://github.com/rxova/react-inputs/pull/60) [`4b038de`](https://github.com/rxova/react-inputs/commit/4b038ded8581e07bdbbb1c4eac116c95c08cfa49) - Preserve existing input text and caret position during multi-value paste, leave composition
  keystrokes to IMEs, and discard stale focus moves when a controlled parent refuses a removal.
