# @rxova/react-phone-input

## 1.0.1

### Patch Changes

- [#65](https://github.com/rxova/react-inputs/pull/65) [`26f06a5`](https://github.com/rxova/react-inputs/commit/26f06a50a471dbb647c3411a5f289ed3797720c3) - Point `homepage` at the canonical documentation URL instead of the short route.

  `/packages/react-inputs/phone` is not a dead link — `astro.config.mjs` emits a `/{slug}` redirect for every component, so it has always resolved. But it resolves through a meta-refresh stub, and it was only six of the nine: currency, OTP and rating already pointed straight at `/components/{slug}/introduction/`. Since `homepage` is what npm renders as the package page's home link, that click now lands on the destination rather than on a hop, and the field reads the same way across the suite.

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

- [#60](https://github.com/rxova/react-inputs/pull/60) [`4b038de`](https://github.com/rxova/react-inputs/commit/4b038ded8581e07bdbbb1c4eac116c95c08cfa49) - New package: an international phone input with no metadata blob.

  Country names come from `Intl.DisplayNames` and flags from Unicode regional indicators — the two
  biggest line items in every competitor's payload, both replaced with something the platform already
  ships. What remains is a ~4 kB dial-code table, so the whole component is ~6 kB brotli with zero
  runtime dependencies, against five dependencies and 10.2 MB unpacked for the category leader.

  E.164 in and out, as-you-type formatting that keeps the caret where you left it, national and
  international entry (including the `00` and NANP `011` prefixes), per-country length checks named
  `possible` rather than `valid`, and a native `<select>` plus `<input type="tel">` so mobile gets the
  platform's own country picker. `onWarn` reports rejected props and is stripped from production
  builds.

- [#60](https://github.com/rxova/react-inputs/pull/60) [`4b038de`](https://github.com/rxova/react-inputs/commit/4b038ded8581e07bdbbb1c4eac116c95c08cfa49) - Add `dir`, `autoFocus` and `aria-label`, emit `data-readonly`, and expose `clear()` from the hook.

  `clear()` empties the number and keeps the selected country: they are separate choices, and
  resetting to the default country would silently discard the one the user picked.

  `dir` lays the field out without touching what is in it — the country select still leads, and the
  formatting still comes from the dial-code table.

- [#60](https://github.com/rxova/react-inputs/pull/60) [`4b038de`](https://github.com/rxova/react-inputs/commit/4b038ded8581e07bdbbb1c4eac116c95c08cfa49) - Always cap the phone field's length. `maxLength` is new, defaults to `32`, and only moves the cap —
  it cannot remove it. An unbounded field lets a single paste drive unbounded work on every keystroke:
  the contents are re-parsed against the calling-code table, re-grouped and re-formatted, and the
  caret position re-derived, none of which is bounded by the number itself.

  `32` is derived rather than picked. E.164 caps a number at 15 digits including the calling code, so
  the longest text this field can produce is 21 characters — the `+`, the code, and the digits with
  their grouping separators — and the adversarial suite now asserts that against the country table
  rather than trusting the figure. `32` leaves half again as much room for the brackets, dashes and
  spaces people paste (`+44 (0)20 7123 4567` is 20 characters), so no number written the way people
  write phone numbers is truncated.

  A `maxLength` below `21` cannot hold a number the component itself formats, and a non-finite one
  bounds nothing at all; both fall back to the default and report the new `max-length-too-small`
  warning code. The cap is enforced on the rendered `<input>`, in `usePhoneInput` before parsing (the
  attribute does not cover a programmatic paste or a headless renderer), and again after formatting,
  since grouping inserts separators that push text already at the cap past it. `usePhoneInput` now
  returns the coerced `maxLength` so a custom renderer can apply it too.

- [#60](https://github.com/rxova/react-inputs/pull/60) [`4b038de`](https://github.com/rxova/react-inputs/commit/4b038ded8581e07bdbbb1c4eac116c95c08cfa49) - Add `showValidity` / `validityLabel`, and make the country select's type-ahead work.

  The country options now lead with the country name rather than the flag. A native select matches
  type-ahead from the first character of the option's text, and a leading flag emoji is a Unicode
  regional-indicator pair — so pressing `f` matched nothing and the picker felt broken. Options read
  `France 🇫🇷 +33`, and `renderCountry` overrides still work (keep the name first to keep type-ahead).

  `showValidity` reports whether the digits are a length the selected country uses. It waits until
  focus has left the field, because every number is the wrong length while it is still being typed,
  and stays silent on an empty field. The message is announced politely, referenced by
  `aria-describedby`, and sets `aria-invalid` when the length is unusable — an explicit `invalid` prop
  still wins.

### Patch Changes

- [#60](https://github.com/rxova/react-inputs/pull/60) [`4b038de`](https://github.com/rxova/react-inputs/commit/4b038ded8581e07bdbbb1c4eac116c95c08cfa49) - Make Backspace and Delete remove the adjacent digit at formatting boundaries instead of deleting a
  separator that the formatter immediately restores.
