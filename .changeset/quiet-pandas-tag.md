---
'@rxova/react-tags-input': minor
---

New package: a tag input where the keyboard actually works.

Not the smallest option in this category — `react-tagsinput` is 3.1 kB against this package's
3.6 kB, and the manifest says so plainly. The case is six accessibility failures that are present
in the most-downloaded alternatives and each of which has a test here:

- focus after a removal never lands on `<body>`; it moves to the next tag, the previous, or the
  entry box
- a roving tabindex gives the whole list one tab stop rather than one per tag
- Backspace from an empty box takes two presses, so the user sees what they are about to delete
- every remove button is named after its own tag rather than "Remove"
- additions and removals are announced politely, with a pasted batch announced once
- no `role="combobox"` without a popup to back it up

Plus configurable delimiters, paste splitting on delimiters and newlines, case-insensitive dedupe,
`max`, length bounds in codepoints, contained `transform`/`validate`, one hidden input per tag so a
native form posts an array, and `onWarn` with seven codes stripped from production builds.
