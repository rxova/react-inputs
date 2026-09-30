---
"@rxova/react-otp-input": patch
---

Build with the shared rxova tsdown preset, which targets ES2020: `??=` in the bundle is now emitted as `??` with an assignment, so the output also runs on engines without ES2021 syntax. The type declarations and README examples use the unified formatting (double quotes, semicolons). No API or behaviour change.
