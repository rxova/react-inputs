---
'@rxova/codemod': minor
---

Add `currency-on-change` for the 1.0 handler swap in `@rxova/react-intl-currency-input`:
`onValueChange` becomes `onChange`, and any native `onChange` becomes `onNativeChange`.

Both renames are applied in a single pass over each element, which is the reason this is a codemod
and not a documented find-and-replace — done sequentially, the value handler walks through both
steps and silently ends up on the native prop. The component is resolved through its import, so an
alias is followed and a same-named component from another library is left alone. `useCurrencyInput`
options objects take the same rename.
