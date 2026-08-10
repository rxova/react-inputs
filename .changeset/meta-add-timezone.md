---
'@rxova/react-inputs': minor
---

Re-export `@rxova/react-timezone-input`, so `TimezoneInput`, `useTimezoneInput` and the zone helpers
are available from the meta-package. None of its export names collide with the existing nine, so it
comes through as a star export.
