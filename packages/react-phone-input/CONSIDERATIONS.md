# Considerations — `@rxova/react-phone-input`

Assumptions taken without asking, and the judgement calls behind them. Everything here is up for
review; each entry says what was decided and why.

## Naming and placement

1. **Package `@rxova/react-phone-input`, directory `packages/react-phone-input`.** Matches the
   existing `react-otp-input` / `react-rating-input` pattern. Starts at `0.0.0` with a `minor`
   changeset, so the first release is `0.1.0`.
2. **Not added to the `@rxova/react-inputs` meta-package.** That is a user-facing change to an
   already-published package and belongs in its own PR once the three new inputs are reviewed.

## The central trade

3. **Length-based _possibility_, not carrier-level _validity_.** This is the whole reason the
   package can be 6 kB instead of 150. It is named honestly everywhere — the field is `possible`,
   the README says it in the same words, and the type doc says it again. If you disagree with this
   trade, the right answer is `libphonenumber-js`, not a bigger table here.
4. **Names come from `Intl.DisplayNames`, flags from Unicode regional indicators.** Both are free
   and both are what the competition spends most of its payload on. Consequence: **on Windows a
   flag renders as two letters** rather than a flag. Judged a legible fallback rather than a
   defect; a consumer who disagrees can pass `renderCountry`.

## The country table

5. **~234 entries, hand-maintained, in one compact string.** It carries ISO code, calling code,
   national lengths and a conventional grouping. Lengths and groups are present for the regions
   that carry most traffic and absent elsewhere, where the generic E.164 bounds (4–15) and grouping
   in threes apply.
6. **Shared calling codes resolve to the first table entry.** +1 covers 25 entries and +7 covers
   two; the calling code alone genuinely cannot distinguish them. The United States wins +1 and
   Kazakhstan wins +7 by table order, which is what every phone field does. Callers who need a
   specific one pass `country`.
7. **Calling codes are matched longest-first.** `350` (Gibraltar) and `351` (Portugal) both start
   with `35`, so shortest-first would have to guess.
8. **A leading zero is stripped as a trunk prefix everywhere except Italy**, where it is part of
   the number. That is the well-known exception; encoding it is smaller and more honest than
   pretending the rule is universal. **Other exceptions may exist and are not encoded.**
9. **`011` is honoured as an international prefix only inside the NANP.** Elsewhere `011x` is a
   legitimate area code — `0113` is Leeds.
10. **The UK grouping (`4-6`) favours mobiles.** `07911 123456` formats correctly; a London
    landline reads `2071 234567` rather than `20 7123 4567`. UK area codes are 2, 3, 4 or 5 digits
    and telling them apart needs the metadata this package deliberately does not carry.
    **Known limitation.**
11. **The tests assert structural invariants, not every value.** Pinning 234 dial codes would turn
    any correction into a 234-line diff and would not catch the failure that matters — a malformed
    entry making lookups unpredictable. Instead: unique ISO codes, well-formed dial codes, lengths
    within E.164, and groupings that sum to a declared length.

## Value and behaviour

12. **The public value is E.164 (`+14155552671`) or `''`.** One canonical format in and out, never
    the formatted display text — which changes with the country and would make the value a
    presentation detail.
13. **The _text_ is the source of truth, and the value is derived from it.** The other direction
    reformats mid-word: a user four digits into a ten-digit number has no valid E.164 value at all,
    and rebuilding the display from `''` on every keystroke erases what they typed.
14. **`defaultCountry` is `US`.** Arbitrary, and the most common default in this category. Pass
    your own; geo-detection is an app concern and needs a network call this package will not make.
15. **The initial country comes from the initial _value_ when there is one.** A field mounted with
    `+44…` is a UK number whatever `defaultCountry` says.
16. **An explicit `+…` number wins over a controlled `country` prop.** A deliberate reading:
    `country` controls which country _national_ input is interpreted against, and a number typed as
    `+33 …` is French by its own contents. Showing "United States" beside it would break the
    stronger invariant that the select and the text never disagree about what is in the field. The
    parent is told through `onCountryChange` and can reject the value.
17. **Changing country keeps the typed digits.** The digits are the user's input; the calling code
    is ours. The number may become not-possible, which is visible.
18. **An empty or entirely-unknown `countries` list falls back to the full table.** A picker with
    nothing in it is not a usable field.
19. **A read-only field disables its country select.** Otherwise the value could change without
    the number changing.
20. **The caret is anchored on digit counts, not character offsets.** Inserting a separator
    invalidates every offset after it. Restoration is skipped when the field is not focused,
    because setting a selection on an unfocused input steals focus in some engines.
21. **Non-Latin numerals are normalised** — Arabic-Indic, extended Arabic-Indic and full-width.
    A user typing on their own keyboard layout should not be silently ignored.

## Accessibility judgement calls

22. **A native `<select>`, not a custom listbox.** On mobile that is the OS picker: searchable,
    scrollable with a thumb, already localised. No custom widget of 234 options matches it, and it
    gives keyboard type-ahead and form semantics for free. The cost is that options cannot be
    richly styled — accepted deliberately.
23. **`type="tel"`, not `type="number"`.** `number` strips leading zeros, offers a spinner, and
    refuses `+` entirely.
24. **The country select has its own accessible name**, so it is not announced as an unlabelled
    combobox.
25. **The E.164 value is a `type="hidden"` input**, never focusable and never announced; the
    visible controls are the accessible representation.

## Testing

26. **The E2E suite types character by character; the browser suite mostly fills.** That
    difference found a real bug: a lone `+` was erased the instant it was typed, so international
    entry was impossible one keystroke at a time — and `fill()` hid it completely by setting the
    whole string at once. There is now a regression test at both levels.
27. **Six branches are excluded from coverage with `v8 ignore`**, all DOM- or type-driven
    defensive arms — `codePointAt` on a character taken from a string, `selectionStart` on a `tel`
    input, `Intl.DisplayNames.of` returning undefined under `fallback: 'code'`. Excluded rather
    than "covered" by tests that would have to fake the platform. Everything else is at 100%.
28. **The E2E suite asserts the diagnostics path is _absent_** from the production demo bundle,
    which is the only place that claim can be checked for real.

## Known limitations

29. **No carrier-level validity, number type, or extensions** — out of scope.
30. **Flags render as letters on Windows** — see 4.
31. **UK landline grouping is approximate** — see 10.
32. **Shared calling codes cannot be distinguished from the number alone** — see 6. A US/Canada
    distinction in particular would need NANP area-code data this package does not carry.
33. **Trunk-prefix handling encodes one exception.** If another country turns out to keep its
    leading zero, it is one entry in `KEEPS_LEADING_ZERO`.
