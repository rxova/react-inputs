---
'@rxova/react-date-input': minor
---

Add `dir`.

Segment order is decided by `Intl` from the `locale`, and writing direction is a separate question:
a Hebrew page showing an en-GB date still wants day, month, year — laid out right to left. Nothing
else in the field changes, which the test pins by asserting the segment order is untouched.
