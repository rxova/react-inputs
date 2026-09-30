---
"@rxova/react-password-input": patch
---

Internal: the isomorphic layout effect now comes from `@rxova/ts-utils`, inlined at build time

The package still has no runtime dependencies. The hook picks `useLayoutEffect` when a `document`
exists and `useEffect` otherwise, as before.
