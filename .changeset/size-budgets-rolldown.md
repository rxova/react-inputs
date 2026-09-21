---
'@rxova/react-otp-input': patch
'@rxova/react-intl-currency-input': patch
---

Size budgets restated for size-limit 14

size-limit 14 bundles with rolldown instead of esbuild, and reads the same `dist/` about 230 B
heavier for `OtpInput` and 80 B heavier for `CurrencyInput`. The shipped code did not grow. The
budgets move to 4.7 kB and 3.35 kB, and the README badges follow.
