---
'@rxova/react-inputs': minor
---

Re-export the six new inputs — password, phone, date, time, tags and file — so the whole suite is
nine components from one install.

Currency, rating, otp, phone and password come through with `export *`. The remaining four export
their components and hooks by name, because their pure helpers collide once merged into a single
namespace: `toISO`, `fromISO`, `compareISO` and `withinRange` mean different things in the date and
time packages, and `attempt` / `attemptAll` mean different things in tags and file. Those names are
correct in their own package and ambiguous here, so they stay there — import them from
`@rxova/react-date-input` and friends directly. Every widget, hook and type still comes through.

The package `llms.txt` grew the six new rows, the note about the named re-exports, and a corrected
list of value conventions: an agent reading it now learns that `TagsInput` emits `string[]` and
`FileInput` emits `File[]` before it wires either into a form.
