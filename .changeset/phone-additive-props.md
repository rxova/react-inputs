---
'@rxova/react-phone-input': minor
---

Add `dir`, `autoFocus` and `aria-label`, emit `data-readonly`, and expose `clear()` from the hook.

`clear()` empties the number and keeps the selected country: they are separate choices, and
resetting to the default country would silently discard the one the user picked.

`dir` lays the field out without touching what is in it — the country select still leads, and the
formatting still comes from the dial-code table.
