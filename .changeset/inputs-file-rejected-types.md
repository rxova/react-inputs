---
'@rxova/react-inputs': minor
---

Re-export `FileAccepted` and `FileRejected` from `@rxova/react-file-input`

`onReject` on `FileInput` now receives a `FileRejected`, whose `reason` is always set, and
`attempt()`/`attemptAll()` return `FileAccepted | FileRejected`. Both types come through the
meta-package, so a consumer of this package can name them.
