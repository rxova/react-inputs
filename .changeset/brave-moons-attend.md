---
'@rxova/react-phone-input': minor
---

New package: an international phone input with no metadata blob.

Country names come from `Intl.DisplayNames` and flags from Unicode regional indicators — the two
biggest line items in every competitor's payload, both replaced with something the platform already
ships. What remains is a ~4 kB dial-code table, so the whole component is ~6 kB brotli with zero
runtime dependencies, against five dependencies and 10.2 MB unpacked for the category leader.

E.164 in and out, as-you-type formatting that keeps the caret where you left it, national and
international entry (including the `00` and NANP `011` prefixes), per-country length checks named
`possible` rather than `valid`, and a native `<select>` plus `<input type="tel">` so mobile gets the
platform's own country picker. `onWarn` reports rejected props and is stripped from production
builds.
