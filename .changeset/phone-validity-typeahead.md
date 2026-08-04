---
'@rxova/react-phone-input': minor
---

Add `showValidity` / `validityLabel`, and make the country select's type-ahead work.

The country options now lead with the country name rather than the flag. A native select matches
type-ahead from the first character of the option's text, and a leading flag emoji is a Unicode
regional-indicator pair — so pressing `f` matched nothing and the picker felt broken. Options read
`France 🇫🇷 +33`, and `renderCountry` overrides still work (keep the name first to keep type-ahead).

`showValidity` reports whether the digits are a length the selected country uses. It waits until
focus has left the field, because every number is the wrong length while it is still being typed,
and stays silent on an empty field. The message is announced politely, referenced by
`aria-describedby`, and sets `aria-invalid` when the length is unusable — an explicit `invalid` prop
still wins.
