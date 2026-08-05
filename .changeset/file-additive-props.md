---
'@rxova/react-file-input': minor
---

Add `autoFocus` and `aria-label`.

`autoFocus` lands on the drop zone rather than the `<input type="file">`. The input is visually
hidden so it can carry `name`, `accept` and `required` into a native submit; focusing it would put
the focus ring somewhere a sighted keyboard user cannot see, on a control they are not meant to
operate directly.
