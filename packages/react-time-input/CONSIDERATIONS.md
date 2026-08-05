# Considerations — `@rxova/react-time-input`

Assumptions taken without asking, and the judgement calls behind them. Everything here is up for
review; each entry says what was decided and why.

## Naming and placement

1. **Package `@rxova/react-time-input`, directory `packages/react-time-input`.** Matches the
   existing pattern. Starts at `0.0.0` with a `minor` changeset, so the first release is `0.1.0`.
2. **Not added to the `@rxova/react-inputs` meta-package.** That is a user-facing change to an
   already-published package and belongs in its own PR.
3. **A sibling of `@rxova/react-date-input`, not a merge with it.** They share a shape and a
   philosophy but nothing else: separate packages mean an app that only needs a time does not ship
   a calendar's worth of month names. Composing them for a date-time is the app's call.

## The value type

4. **The public value is `HH:mm` or `HH:mm:ss`, always 24-hour, always zero-padded.** One canonical
   format means a value can be stored, compared and sorted without knowing which locale produced
   it. A field displaying `02:30 PM` posts `14:30`.
5. **A string, never a `Date`.** A time of day is not an instant — see the README. There is
   deliberately no `toDate()` helper, because it cannot be written without inventing a date and a
   timezone the caller did not supply.
6. **Seconds appear in the value only when `showSeconds` is on.** The canonical form matches the
   field the user is actually filling, rather than claiming a precision they were never offered.
7. **Range comparisons are string comparisons on the shared prefix**, so a bound given as `09:00`
   orders correctly against a value of `09:00:30`.
8. **`hour` is stored 0–23 internally even in a 12-hour field.** One representation, translated at
   the edges. The alternative — storing the clock-face hour plus a period — puts the fold in every
   comparison instead of in one function.

## Behaviour

9. **12- or 24-hour comes from the locale**, overridable with `hour12`. Guessing from the user's
   own settings is right far more often than a hard-coded default.
10. **Midnight is `12 AM` / hour 0, noon is `12 PM` / hour 12.** The fold happens _before_ the
    period offset is applied, or `12 + 12` would be 24. The adversarial suite sweeps all 24 hours
    rather than sampling, because this is wrong in exactly two places.
11. **Typing a new hour keeps the existing day period.** Retyping the hour on a 3 PM appointment
    must not silently move it to 3 AM.
12. **Choosing a day period before any hour exists is remembered**, by storing it as the
    corresponding midnight or noon hour. The alternative — discarding it — makes the obvious
    "PM first, then the hour" entry order fail.
13. **`onChange` fires only on a complete, valid time, and only when the number being typed is
    finished.** Typing `45` into a minute passes through `4`, which with the hour filled is already
    a complete time; an unconditional emit reports 4 past the hour and a form that saves on change
    persists it. A number left half-typed is settled on blur or on moving to another segment.
14. **Out-of-range times are still emitted** (`emitOutOfRange`, default `true`) with the field
    marked invalid. Swallowing them makes a field that looks accepted and a form that will not
    submit, with nothing connecting the two.
15. **A `min` after `max` drops both bounds and warns**, and the warning says explicitly that
    midnight-wrapping ranges are not modelled. `22:00`–`06:00` is two ranges; pretending otherwise
    would make `withinRange` lie.
16. **Steps must divide 60.** A 7-minute step leaves a 4-minute bucket at the top of every hour, so
    arrowing up from `:56` lands off the grid. Invalid steps fall back to 1 and warn.
17. **Arrow keys wrap the value but clamp the focus**, so the field never becomes a trap you cannot
    arrow out of.
18. **The day period ignores digits** and takes `a`/`p` — or the localised first letter, so a
    German user typing `v` for "vorm." is understood.
19. **Auto-advance fires as soon as no further digit could keep the value in range** — after `3` in
    a 24-hour hour, after `2` in a 12-hour hour, after two digits anywhere.
20. **A lone `0` is held in the buffer on a 12-hour clock**, where it is not an hour, and committed
    immediately on a 24-hour clock, where it is midnight.
21. **Clearing the hour clears the day period with it**, because the period is derived from the
    hour rather than stored separately. Showing "AM" beside an empty hour would claim a half the
    field does not have.
22. **Read-only fields keep their tab stops**; disabled ones do not, matching native controls.

## Accessibility judgement calls

23. **`role="group"` of `role="spinbutton"`s**, including the day period — it is a bounded value
    stepped with arrows, which is exactly what a spinbutton is.
24. **The day period announces as its localised word**, never as 0 or 1, and an E2E test asserts
    no `aria-valuetext` on the page is a bare digit.
25. **An empty segment has no `aria-valuenow`** and announces its placeholder — a 0 would be a lie
    about the value.
26. **Separators are `aria-hidden`.** Reading "colon" between two named spinbuttons adds nothing.
27. **A `ReactNode` label is rendered off-screen and referenced with `aria-labelledby`**, because a
    node cannot become an `aria-label`.
28. **`required` becomes `aria-required` on the group, not `required` on the hidden input**, which
    is barred from constraint validation and would look like it was doing something.

## Testing

29. **The E2E suite runs all three engines specifically for the clock assertions.** Whether a
    locale is 12- or 24-hour comes from ICU, and the three engines ship different ICU builds.
30. **The locale tests assert relationships, not exact separators.** ICU changes those between
    versions, and pinning them would fail the suite on a Node upgrade for no real reason.
31. **Four branches are excluded from coverage with `v8 ignore`**, all platform guards: the
    `hourCycle` fallback for engines that do not report `hour12`, a locale with no day period at
    all, an engine returning fewer parts than requested, and an unreachable `??` arm whose
    condition was already proven. Excluded rather than "covered" by stubbing `Intl`, which would
    only prove the stub works.
32. **The E2E suite asserts the diagnostics path is _absent_** from the production demo bundle,
    which is the only place that claim can be checked for real.

## Known limitations

33. **No popup, no dates, no time zones, no durations, no midnight-wrapping ranges** — out of
    scope.
34. **Digits are rendered in Latin numerals**, even in locales whose `Intl` output uses other
    numeral systems, for the same reason as the date field: editing a numeral system the keyboard
    does not produce would be worse than the inconsistency.
35. **`minuteStep` snaps arrow stepping, not typing.** A user can type `09:07` under a 15-minute
    step. Enforcing the grid on typed input would fight the user mid-entry; validating the final
    value is the form's job.
36. **A half-typed digit is dropped when a controlled `value` arrives.** The buffer belongs to a
    number the user has not finished, and the segment it belongs to has just been replaced — keeping
    it would let the next keystroke extend a number no longer on screen.
