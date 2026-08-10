---
'@rxova/react-duration-input': minor
---

Add the duration input: a segmented, keyboard-first field for days, hours, minutes and seconds as a
headless, zero-dependency React control.

Every unit is a real `role="spinbutton"` with the locale's own word as its accessible name — `hours`,
`Stunden`, `時間`, from `Intl.NumberFormat` — plus `aria-valuenow`, `aria-valuemin` and an
`aria-valuetext` that reads as a quantity rather than a bare digit. Not one of the five duration
packages on npm mentions `aria`, `role=` or `tabindex` anywhere in its README, and no major design
system ships a duration field at all.

The largest unit on screen is deliberately unbounded, because `90` in a minutes box is a real
ninety-minute duration and refusing it is fighting the most common thing anyone types. Units below it
are bounded by the unit above and settle on blur, so `90` in the minutes of an `h:m` field becomes
`1h 30m`. `aria-valuemax` is omitted on the leading segment rather than set to a large number: the
attribute is a promise about a ceiling, and there is none.

The value is an ISO 8601 duration — `PT1H30M`, never a number of seconds and never a `Date` — and
this is the first value in the suite that is canonical without being lexically ordered. `'PT10M' <
'PT2H'` is true as strings and false as durations, so `compareDurations`, `toSeconds`,
`secondsToDuration` and `withinDurationRange` ship as pure, separately importable helpers and
`min`/`max` use them. The emitted value is always normalised, so two equal durations from this field
compare equal with `===` too. The helpers are named for durations rather than reusing the suite's
`toISO`/`fromISO`, which already collide between the date and time packages.

Calendar units are refused rather than approximated: in ISO 8601 `P1M` is one month and `PT1M` is
one minute, and reading one as the other is a factor of 43,200. Months and years are not a fixed
number of seconds, so the parser reports `value-calendar-unit` with the explanation instead of
guessing. Weeks are fixed at seven days and are accepted.

Hostile data and hostile callbacks are contained rather than propagated: a `units` array with an
unknown entry, a duplicate or the wrong order is repaired and warned about, a step that does not
divide 60 falls back to 1 so the arrows can never be inverted or dead, a locale tag `Intl` refuses
falls back to `d`/`h`/`m`/`s`, and `renderSegment`, `onPartsChange` and `onWarn` all fall back to
built-in behaviour when they throw. `onChange` is the deliberate exception and still propagates — it
is the consumer's state setter, and swallowing it would desync the parent while hiding the bug.
