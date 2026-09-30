---
"@rxova/react-intl-currency-input": patch
---

Internal: development warnings now come from `@rxova/ts-utils`'s `createDevWarner`, inlined at build time

The package still has no runtime dependencies, and warnings print, dedupe and stay silent in production as before. The
brotli size budget moves from 3.35 kB to 3.6 kB to make room for it, and the README badge follows.
