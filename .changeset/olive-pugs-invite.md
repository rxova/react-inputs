---
'@rxova/react-date-input': minor
---

New package: a segmented, keyboard-first date field with no calendar and no date library.

Segment order, separators and month names come from `Intl`, so every locale is correct and the
package still has zero runtime dependencies. The value is a `YYYY-MM-DD` string end to end and no
`Date` is ever constructed, which removes the off-by-one that follows from modelling a calendar
date as an instant.

Full keyboard entry with auto-advance, arrow stepping, Home/End and Backspace; `spinbutton`
semantics per segment with bounds that narrow as the date fills in and the month announced by name;
inclusive `min`/`max` that mark rather than discard an out-of-range date; and `onWarn` reporting
rejected props, stripped entirely from production builds.
