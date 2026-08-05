---
'@rxova/react-password-input': patch
---

Report a second, different misconfiguration of the same prop.

`PasswordWarning` was the only warning type in the suite with no `received` field, so warnings could
only be deduplicated by `code`. A component rendered with `minLength={-1}` and later `minLength={-5}`
warned once and swallowed the second — the case a developer most needs told about, since it means
the value they just changed is still wrong.

`received` is now carried by every inspector and the dedupe key is `code:received`, matching
`useDateInput` and the rest. Adding a field to a development-only diagnostic object is a patch: the
type is emitted, never accepted, and the whole path is stripped from production builds.
