---
'@rxova/react-inputs': major
---

**Breaking:** the styling hooks of every component in the suite are namespaced `--rx-<name>-*` /
`data-rx-<name>-*` — `--rx-otp-slot-size`, `--rx-rating-size`, `--rx-password-gap`,
`--rx-date-segment-radius`, and so on. This package adds no styling of its own, but it is the
install a stylesheet is most likely written against, so the break lands here too.

The two components whose published names changed are `@rxova/react-otp-input` (`--otp-*`) and
`@rxova/react-rating-input` (`--rfs-*`); see their changelogs and
`npx @rxova/codemod rx-token-prefixes`.

The date and time fields also now paint a focus ring on the segment that has focus. A
`<span role="spinbutton">` gets none from the browser, and the packages previously shipped
`outline: none` with nothing in its place, so a keyboard user could not see which segment they were
on. Restyle it with `--rx-date-focus-ring` / `--rx-time-focus-ring` rather than removing it.
