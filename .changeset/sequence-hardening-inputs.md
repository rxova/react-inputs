---
'@rxova/react-file-input': minor
'@rxova/react-tags-input': patch
'@rxova/react-phone-input': patch
'@rxova/react-date-input': patch
'@rxova/react-time-input': patch
---

Fix six defects that only appear under real event sequences.

Every one of these sat inside code the suite already covered at ~99%. The tests drove synthesised
sequences — a hand-balanced pair of `dragover`/`dragleave`, a paste into an always-empty box, focus
set programmatically — which get the DOM right and the _sequence_ wrong. A new
`sequences.browser.test.tsx` in each package drives the sequence a browser actually produces.

- **file:** the drop zone stayed highlighted forever after a drag that left without dropping.
  `onDragEnter` and `onDragOver` were bound to the same depth-counting handler, and a real browser
  repeats `dragover` for as long as the pointer hovers, so the depth climbed without bound and the
  one matching `dragleave` could never return it to zero. `dragover` no longer counts; the hook
  gains a separate `handleDragEnter` to bind alongside it. A drop carrying no files is now left to
  the browser rather than consumed, matching the drag handlers.
- **tags:** a multi-value paste into a box that already held text destroyed that text — it was
  neither committed as a tag nor left behind to correct. Only the range the paste would have
  replaced is consumed now, and the caret stays where it was.
- **tags:** with a Japanese, Chinese or Korean IME the `Enter` that confirms a candidate was treated
  as a delimiter, committing half-composed text and eating the keystroke; Backspace reached for the
  last tag instead of deleting a candidate character. Keys arriving mid-composition are now left to
  the IME.
- **tags, file:** a controlled parent that refused a removal left a pending focus move that was
  replayed on its next unrelated render, yanking focus off whatever the user was on.
- **phone:** Backspace and Delete at a group boundary removed only the separator, which the
  formatter immediately re-inserted — the value came back identical and the keystroke was dead, so
  backspacing through `415 555 2671` needed two presses at each boundary. The digit the user was
  aiming at is now the one that goes. This costs ~60 B, so `PhoneInput`'s size budget moves from
  4.25 kB to 4.4 kB — the single `deleteDigit` already replaces the mirrored pair it started as, and
  shaving it further would cost more in clarity than it saves in bytes.
- **date, time:** a half-typed digit survived a controlled `value` change, so the next keystroke
  extended a number that was no longer on screen — type `2` into the day, let the parent write a new
  date, type `3`, and the day became 23.

Also removes `snapToStep` from `@rxova/react-time-input`'s internals: it was fully unit-tested,
exported from `time.ts`, and called from nowhere. `minuteStep` and `secondStep` move the arrow keys
onto a grid and deliberately leave typed values alone, which is the documented contract.
