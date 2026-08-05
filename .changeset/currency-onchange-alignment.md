---
'@rxova/react-intl-currency-input': major
---

**Breaking:** `onChange` now emits the parsed value, like every other input in the suite. The raw
DOM event moved to `onNativeChange`.

| Before          | After            | Carries                            |
| --------------- | ---------------- | ---------------------------------- |
| `onChange`      | `onNativeChange` | The raw DOM event                  |
| `onValueChange` | `onChange`       | The parsed `number \| null` + meta |

`npx @rxova/codemod currency-on-change ./src` does both, and doing both in one pass is the point:
renaming `onValueChange` → `onChange` first and `onChange` → `onNativeChange` second walks the value
handler through both steps and lands it on the wrong prop.

`onValueChange` still works and still fires, warning once in development, so a codebase can migrate
gradually. It will be removed in a later major.

This was the one component in the suite where `onChange` meant the DOM event — the exact inversion
of the convention the root README states, and the only place a reader moving between two of these
packages had to remember an exception.
