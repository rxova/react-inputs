---
'@rxova/react-time-input': minor
---

New package: a segmented, keyboard-first time field with no clock popup and no date library.

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
