---
'@rxova/react-password-input': patch
---

Fire `onBlur` when focus leaves from the reveal toggle.

The handler was attached to the `<input>`, so it only ever saw focus leaving the input. Tabbing
out of the field from the toggle — the ordinary way out, since the toggle is the last thing in the
field — fired nothing at all: no `onBlur` for the form library, and no re-mask for `hideOnBlur`.

It now sits on the element containing both, where `focusout` bubbles to. The containment check that
keeps focus moving _within_ the field silent is unchanged.

This is the bug that surfaced the moment the package got the `onBlur` test its five siblings
already had. It had shipped unreported because nothing asserted the claim its own types made.
