---
'@rxova/react-tags-input': minor
---

Add `dir`, `autoFocus` and `aria-label`, and expose `clear()` from the hook.

`clear()` empties the tags **and** the entry box. Half-clearing is the bug it exists to avoid: a
form reset that leaves a half-typed tag behind still submits it on the next blur, because
`addOnBlur` defaults to `true`.
