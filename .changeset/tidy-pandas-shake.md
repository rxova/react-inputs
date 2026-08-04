---
'@rxova/react-password-input': minor
---

New package: a headless, zero-dependency password input.

A reveal toggle that keeps focus and the caret where they were, a Caps Lock warning read off the
real modifier state, a 1.2 kB entropy estimator (swap in zxcvbn with the `estimate` prop if you
want its wordlists), a NIST SP 800-63B-aligned requirement checklist, and an optional debounced,
abortable breach check that the library never calls the network for itself.

`onWarn` reports coerced or dangerous configuration — a `maxLength` below `minLength`, an
`autocomplete` that breaks password managers — and the whole diagnostics path is stripped from
production builds.
