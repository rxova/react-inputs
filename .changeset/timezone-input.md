---
'@rxova/react-timezone-input': minor
---

Add `@rxova/react-timezone-input`: a headless, accessible time zone picker built entirely on `Intl`.

No tz database in the bundle and no runtime dependencies — 419 zones, localised names and live DST
offsets come from the engine's own ICU, which updates with the browser rather than with a package
release.

Three things it fixes that a picker built straight off `Intl.supportedValuesOf('timeZone')` gets
wrong: `UTC` is not in that array and nothing in it stands in for it, so it is added first; a stored
`Europe/Kyiv` selects the option an engine spells `Europe/Kiev` and vice versa, resolved through
`Intl`'s own canonicalisation rather than a bundled alias table; and an offset is read at a
`referenceDate` rather than treated as a property of a zone, because Sydney is `+11:00` in January
and `+10:00` in July.

The value is always an IANA id, never an offset — an offset such as `+02:00` is refused with a
`value-offset-not-zone` warning, since it cannot express a daylight-saving change. The renderer is a
native `<select>` with `<optgroup>` grouping, so type-ahead, the keyboard contract, the mobile picker
and form submission are the platform's. `useTimezoneInput` exposes the same state machine with no
markup, and the pure helpers (`resolveZone`, `zoneOffsetMinutes`, `zoneOffsetLabel`, `zoneLabel`,
`zonePhase`, `localZone`, `ZONES`, `groupByArea`) are usable on their own.
