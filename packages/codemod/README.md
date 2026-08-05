<p align="center">
  <img src="./assets/logo.svg" width="112" alt="@rxova/codemod logo" />
</p>

<h1 align="center">@rxova/codemod</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/@rxova/codemod"><img src="https://img.shields.io/npm/v/@rxova/codemod?color=cb3837&logo=npm&logoColor=white" alt="npm version" /></a>
  <a href="https://github.com/rxova/react-inputs/actions/workflows/ci.yml"><img src="https://github.com/rxova/react-inputs/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI status" /></a>
  <img src="https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white" alt="TypeScript strict mode" />
  <img src="https://img.shields.io/badge/Node-%E2%89%A520.19-5fa04e?logo=node.js&logoColor=white" alt="Node 20.19 or newer" />
  <a href="https://github.com/rxova/react-inputs/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT license" /></a>
</p>

<p align="center">
  <a href="https://rxova.org/packages/react-inputs/"><strong>Documentation</strong></a> ·
  <a href="https://rxova.org/packages/react-inputs/components/otp/migrating/">Migration guides</a>
</p>

[jscodeshift](https://github.com/facebook/jscodeshift) codemods for migrating onto the
[rxova](https://github.com/rxova/react-inputs) input suite. One CLI, one transform per migration.

```bash
# list available transforms
npx @rxova/codemod --help

# preview a transform without writing
npx @rxova/codemod input-otp-to-otp --dry ./src

# apply it
npx @rxova/codemod input-otp-to-otp ./src
```

It parses `.ts` / `.tsx` / `.js` / `.jsx`. `--extensions=css,tsx,ts` widens that set, which only
makes sense for a transform that rewrites text without parsing — `rx-token-prefixes` is one.

## Transforms

### `input-otp-to-otp`

Migrates [`input-otp`](https://github.com/guilhermerodz/input-otp) usage to
[`@rxova/react-otp-input`](https://www.npmjs.com/package/@rxova/react-otp-input).

| Before (`input-otp`)                                              | After (`@rxova/react-otp-input`)                    |
| ----------------------------------------------------------------- | --------------------------------------------------- |
| `import { OTPInput } from 'input-otp'`                            | `import { OtpInput } from '@rxova/react-otp-input'` |
| `OTPInputProps`                                                   | `OtpInputProps`                                     |
| `SlotProps`                                                       | `OtpSlotState`                                      |
| `<OTPInput maxLength={6}>`                                        | `<OtpInput length={6}>`                             |
| `containerClassName`                                              | `className`                                         |
| `pushPasswordManagerStrategy`, `textAlign`, `noScriptCSSFallback` | _removed_ (no width hack, so unneeded)              |
| `slot.placeholderChar`                                            | `slot.placeholder`                                  |

- **Aliases are preserved.** `import { OTPInput as OTP }` keeps `OTP` at the call site; only the
  imported name and module change.
- **Unmapped imports stay put.** Anything without a direct equivalent (e.g. `REGEXP_ONLY_DIGITS`) is
  left importing from `input-otp` with a `TODO` comment, so the file still resolves.
- **`value`, `onChange`, `pattern`** and other compatible props are left untouched.
- The **`render` prop is preserved, not rewritten.** `@rxova/react-otp-input` supports the same
  render-prop tier and the per-slot shape is compatible, so your render function keeps working.
  Converting it into the compound `<OtpGroup>` / `<OtpSlot>` API can't be done reliably by an AST
  transform, so it stays a manual step — the codemod adds a one-line banner pointing at the
  [migration guide](https://rxova.org/packages/react-inputs/components/otp/migrating/).

Always review the diff (`--dry` first) and re-run your formatter afterwards.

### `rx-token-prefixes`

Renames the styling hooks that moved into per-component namespaces in
`@rxova/react-otp-input` 1.0 and `@rxova/react-rating-input` 1.0.

| Before       | After              |
| ------------ | ------------------ |
| `--otp-*`    | `--rx-otp-*`       |
| `data-otp-*` | `data-rx-otp-*`    |
| `--rfs-*`    | `--rx-rating-*`    |
| `data-rfs-*` | `data-rx-rating-*` |

```bash
npx @rxova/codemod rx-token-prefixes --extensions css,scss,tsx,ts,jsx,js ./src
```

- **Include your stylesheets.** That is where most of these names live, and this transform rewrites
  text without parsing, so it can read a `.css` file that a normal codemod could not.
- **The state hooks are left alone** — `data-invalid`, `data-disabled`, `data-readonly`,
  `data-state`, `data-filled`, `data-active`, `data-fill`, `data-idx` did not move, because they
  mean the same thing on every input in the suite.
- **Running it twice is safe.** `--rx-otp-` does not contain `--otp-`, so a second pass is a no-op.
- Quote style and formatting survive, because nothing is reparsed or reprinted.

## Programmatic use

Each transform is exported for use directly with `jscodeshift -t`:

```bash
npx jscodeshift -t node_modules/@rxova/codemod/dist/transforms/input-otp-to-otp.cjs --parser tsx ./src
```

## Adding a transform

Drop a jscodeshift transform in `src/transforms/<name>.ts` and list it in `src/registry.ts`.
The CLI and the build pick it up automatically.

## License

[MIT](https://github.com/rxova/react-inputs/blob/main/LICENSE) © rxova
