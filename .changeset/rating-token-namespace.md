---
'@rxova/react-rating-input': major
---

**Breaking:** every CSS custom property and `data-*` hook is now namespaced `--rx-rating-*` /
`data-rx-rating-*`. `--rfs-size` becomes `--rx-rating-size`, `[data-rfs-root]` becomes
`[data-rx-rating-root]`, and so on for all ten properties and three attributes. The shared state
hooks — `data-state`, `data-fill`, `data-active`, `data-disabled`, `data-readonly`, `data-invalid`,
`data-idx` — are unchanged.

Run `npx @rxova/codemod rx-token-prefixes` over your components, and the `sed` line in the
migration guide over your stylesheets.

`--rfs-` was initials of a name this package no longer has (`react-feedback-stars`), which made it
the one prefix in the suite a reader could not derive from the package they installed — and it sat
one character from `--rfi-`, the file input's. `pnpm check:tokens` now enforces the scheme.
