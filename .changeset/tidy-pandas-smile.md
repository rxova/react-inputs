---
'@rxova/react-inputs': patch
---

Broaden the npm keywords

Registry metadata is read far more often than it is written, and the meta-package
was findable only by somebody who already knew the suite existed. Adds
`input-components`, `form-inputs`, `ui-components`, `component-library`,
`headless-ui` and `design-system` — what this is called by someone shopping for
one — plus `tree-shakeable` and `zero-dependency`, the two properties that decide
whether the meta-package or the individual ones are the right install. No code
changes; a patch release is only how the new metadata reaches npm.
