# Considerations — `@rxova/react-date-input`

Assumptions taken without asking, and the judgement calls behind them. Everything here is up for
review; each entry says what was decided and why.

## Naming and placement

1. **Package `@rxova/react-date-input`, directory `packages/react-date-input`.** Matches the
   existing `react-otp-input` / `react-rating-input` pattern. Starts at `0.0.0` with a `minor`
   changeset, so the first release is `0.1.0`.
2. **Not added to the `@rxova/react-inputs` meta-package.** That is a user-facing change to an
   already-published package and belongs in its own PR once the three new inputs are reviewed.
3. **"No calendar" is read strictly.** No popover, no month grid, no trigger button. The package is
   the alternative to a calendar, not a calendar with the grid hidden.

## The value type

4. **The public value is a `YYYY-MM-DD` string, never a `Date`.** This is the decision the rest of
   the package follows from — see the README. If you want `Date` objects at the API boundary, that
   is a wrapper in your app, where the timezone you mean can be stated explicitly.
5. **`null` means empty**, and a half-typed date is also `null`. `onPartsChange` is the channel for
   anyone who wants per-keystroke state.
6. **Range comparisons are string comparisons.** Correct only because the format is fixed-width and
   big-endian, which is part of why it was chosen.
7. **Years are 1–9999.** Four digits, so the segment can hold them. No BCE, no five-digit years.
   ISO 8601 allows expanded years by agreement; nothing in a form field needs them.
8. **Proleptic Gregorian.** What ISO 8601 and every calendar UI mean. Dates before 1582 are
   therefore "wrong" in the historical sense and right in the ISO sense.

## Behaviour

9. **`onChange` fires only on a complete, real date — and only when the number being typed is
   finished.** Typing `1999` into a year passes through 1, 19 and 199, each of which is a complete
   date once the other segments are filled. An unconditional emit reports `0001-03-15` to the
   parent, and a form that saves on change persists it. Provisional digits update the display and
   `onPartsChange`; `onChange` waits. A number abandoned half-typed is settled on blur or on moving
   to another segment, so nothing the user actually left in the field is withheld.
10. **An impossible date is refused rather than rolled over.** 31 February stays `null` instead of
    becoming 3 March.
11. **Changing the month or year re-clamps the day.** 31 January then February gives the 28th. The
    alternatives are worse: rolling over silently changes the month the user just chose, and
    clearing the day throws away input they did not ask to lose.
12. **The day range does not narrow before it has to.** 31 with no month, 29 in a February with no
    year. Narrowing early would reject a value that is about to become valid, which is the more
    annoying failure.
13. **Out-of-range dates are still emitted** (`emitOutOfRange`, default `true`) with the field
    marked invalid. Swallowing them makes a field that looks accepted and a form that will not
    submit, with nothing connecting the two.
14. **A `min` after `max` drops both bounds** and warns. A field nothing can be entered into is
    worse than a missing bound.
15. **Arrow keys wrap within a segment but clamp between segments.** Wrapping the _value_ is
    conventional for a spinbutton; wrapping the _focus_ would make the field a trap you cannot
    arrow out of.
16. **Auto-advance fires as soon as no further digit could keep the value in range** — after `4` in
    a day, after `3` in a month, after four digits in a year.
17. **Overflow restarts rather than rejects.** `1` then `9` in a month means the user changed their
    mind and wants September.
18. **A lone `0` is held in the buffer, not committed.** It is a legitimate intermediate state on
    the way to `05`, but it is not a value.
19. **ArrowUp on an empty year starts at the current year.** This is the only place in the package
    that reads the clock, and it reads it as "which year is it" — never as a date — so no timezone
    can shift it into the wrong day. Day and month start at 1.
20. **Modified arrow keys are left to the browser.** Ctrl+Arrow is a word jump; a date field has no
    business intercepting it.
21. **Read-only fields keep their tab stops**; disabled ones do not, matching native controls.

## Locale

22. **Order, separators and month names all come from `Intl`.** Zero bytes, correct everywhere.
23. **A malformed locale tag falls back to ISO order and warns.** `Intl` throws `RangeError` on
    `en_US`; crashing a date field over an underscore is the worse outcome.
24. **The reference date used to probe the format is 22 November 3333.** All three parts differ and
    all are at least two digits, so the output is unambiguous when read by a human debugging it.
    Built from a UTC timestamp so the machine's timezone cannot shift it.
25. **Leading and trailing affixes are trimmed.** `ko-KR` and `hu-HU` end with a `.`, `ja-JP` with
    `日` — correct for display, but a dangling character after an editable field.
26. **The digits rendered are the ones the user typed, in Latin numerals**, even in a locale whose
    `Intl` output uses Arabic-Indic or Persian digits. Editing a numeral system the keyboard does
    not produce would be worse than the inconsistency. **Known limitation.**
27. **Non-Gregorian locales take their _order_ from their own calendar but edit Gregorian
    numbers.** `fa-IR` formats 3333 as a Persian year, so the segment order is right and the values
    are not in that calendar. **Known limitation** — a real Persian-calendar field is a different
    component.

## Accessibility judgement calls

28. **`role="group"` of three `role="spinbutton"`s.** A single control cannot tell a screen-reader
    user which part they are on; a spinbutton is exactly what a bounded number with arrow-key
    stepping is.
29. **`aria-valuemax` tracks the narrowing day range**, so the announced range is the real one.
30. **The month announces by name.** "3" is the value; "March" is the choice.
31. **An empty segment has no `aria-valuenow`** and announces its placeholder — a `0` would be a
    lie about the value.
32. **Separators are `aria-hidden`.** Reading "slash" between two named spinbuttons adds nothing.
33. **A `ReactNode` label is rendered off-screen and referenced with `aria-labelledby`**, because a
    node cannot become an `aria-label` and the group would otherwise lose its name.
34. **`required` becomes `aria-required` on the group, not `required` on the hidden input.** A
    hidden input is barred from constraint validation, so the attribute would look like it was
    doing something and do nothing.

## Testing

35. **The E2E suite runs all three engines specifically for the locale assertions.** Segment order
    comes from ICU, and the three engines ship different ICU builds; this is the only place that
    claim is actually checked.
36. **The locale tests assert relationships, not exact separators.** ICU changes separator code
    points between versions, and pinning them would fail the suite on a Node upgrade for no real
    reason.
37. **Three branches are excluded from coverage with `v8 ignore`**, all defensive: an array lookup
    TypeScript types as possibly-undefined after the value has already been range-checked, and a
    guard against `Intl` returning fewer than three parts. Excluded rather than "covered" by tests
    that would have to fake the platform.
38. **The E2E suite asserts the diagnostics path is _absent_** from the production demo bundle,
    which is the only place that claim can be checked for real.

## Known limitations

39. **No calendar, times, ranges, or non-Gregorian editing** — out of scope.
40. **Latin numerals only** — see 26.
41. **No `Date` interop helpers.** Deliberate: adding `toDate()` would put the timezone question
    back inside the library, where it cannot be answered correctly.
42. **A controlled `value` re-syncs only when the prop changes**, not when it merely differs from
    the segments. Mid-entry the segments have no ISO form at all, and comparing against `null`
    would wipe them on every keystroke.
43. **A half-typed digit is dropped when a controlled `value` arrives.** The buffer belongs to a
    number the user has not finished, and the segment it belongs to has just been replaced — keeping
    it would let the next keystroke extend a number no longer on screen.
