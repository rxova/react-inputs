---
'@rxova/react-file-input': minor
---

One tab stop, a named drop zone, re-picking a file, and a `reason` that is always set

- The hidden `<input type="file">` is `tabIndex={-1}`, so Tab goes straight to the drop zone
  instead of first stopping on an invisible control (#94).
- The drop zone is named after the field, then its hint, and shares `aria-describedby`: three file
  fields no longer all read "Choose a file or drop it here". Pass `label` even beside a visible
  `<label htmlFor>`, which names only the input.
- The native input holds only files the field is showing. Picking the same file again after it was
  refused, removed, or dropped by a controlled parent now fires `change` and runs the rules again
  (#95). A native form submit still posts what the field shows; a partly refused pick keeps the
  accepted files.
- `onReject` receives a `FileRejected`, whose `reason` is always set, and `attempt()`/`attemptAll()`
  return `FileAccepted | FileRejected`, which narrows on `accepted` (#96). Both types are exported.
  `FileAttempt` is unchanged, so existing annotations still compile.
