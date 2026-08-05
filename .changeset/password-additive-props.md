---
'@rxova/react-password-input': minor
---

Add `autoFocus` and `aria-label`, emit `data-readonly`, and expose `clear()` from the hook — the
four places this package differed from its siblings for no reason anyone chose.

`aria-label` matters more than it used to: `label` no longer renders an element, so a field with a
visible label supplied by the page had no way to carry a _different_ announced name. It wins over
`label` when both are given.
