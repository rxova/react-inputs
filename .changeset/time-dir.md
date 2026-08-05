---
'@rxova/react-time-input': minor
---

Add `dir`.

Segment order is decided by `Intl` from the `locale`, and writing direction is a separate question.
Nothing else in the field changes, which the test pins by asserting the segment order is untouched.
