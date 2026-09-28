---
'@rxova/react-otp-input': patch
---

Internal: the isomorphic layout effect now comes from `@rxova/ts-utils`, inlined at build time

The package still has no runtime dependencies. The hook picks `useLayoutEffect` when a `document`
exists and `useEffect` otherwise, as before (the OTP input previously checked `window` rather than `document`, which differs only in runtimes that define one without the other).
