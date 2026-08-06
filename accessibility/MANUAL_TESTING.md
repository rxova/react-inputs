# Manual assistive-technology testing

Automated axe and browser tests remain necessary, but they cannot report what a screen reader
announced or whether its virtual cursor followed a composite field correctly. Every component must
pass these scenarios with:

- VoiceOver and Safari on macOS
- NVDA and Chrome on Windows
- NVDA and Firefox on Windows

Use the package demo from the exact source being audited. Record the real operating-system,
browser, and assistive-technology versions; do not infer a pass from automated output.

## Shared checklist

For each component and combination:

1. Navigate to the field with normal screen-reader and Tab navigation. Confirm the visible label,
   role, current value, required state, and disabled or read-only state are announced accurately.
2. Operate every documented keyboard path without a pointer. Confirm focus remains visible and the
   screen-reader cursor does not jump to the document root.
3. Enter a valid value, clear it, and trigger an invalid state. Confirm help text is available and
   the error is announced once without repeating on unrelated keystrokes.
4. Submit the surrounding native form and confirm the field's posted value matches the visible
   state.
5. Repeat the primary flow in right-to-left layout where the component supports `dir`.

## Component scenarios

- **Currency:** type localized decimals, move the caret, blur for formatting, and confirm the
  announced value remains understandable after grouping and currency placement.
- **Rating:** traverse the radiogroup, change the value with arrows, clear where enabled, and confirm
  read-only output is announced as a score rather than an interactive control.
- **OTP:** type, paste, replace from the middle, and confirm one input is announced rather than six
  unrelated boxes.
- **Password:** toggle reveal without losing the caret; cross a strength bucket; trigger Caps Lock,
  rules, and compromised-password announcements once each.
- **Phone:** move between country and number controls, change country without a premature blur
  error, and confirm the canonical value is not announced as a second duplicate field.
- **Date and time:** traverse localized spinbutton segments, type and step values, and confirm empty,
  minimum, maximum, and day-period values are announced correctly.
- **Tags:** add, reject, paste, traverse, and remove tags; confirm roving focus and one polite batch
  announcement.
- **File:** open the picker from the drop-zone button, add and remove files, trigger a rejection,
  and confirm preview images do not duplicate filenames.

## Recording a pass

After all scenarios pass on the unchanged source, run:

```bash
pnpm run a11y:record -- --package date --tester @github-handle \
  --voiceover-safari "macOS 15.6 / Safari 18.6 / VoiceOver 15.6" \
  --nvda-chrome "Windows 11 24H2 / Chrome 138 / NVDA 2025.1" \
  --nvda-firefox "Windows 11 24H2 / Firefox 141 / NVDA 2025.1"
```

Commit the updated JSON record. `pnpm check:a11y-manual` recomputes the package's shippable-source
hash and fails after any non-test source change. Test-only and documentation changes do not
invalidate a result, and records do not expire merely because time passed.
