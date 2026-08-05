<p align="center">
  <img src="./assets/logo.svg" width="180" alt="@rxova/react-otp-input logo" />
</p>

<h1 align="center">@rxova/react-otp-input</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/@rxova/react-otp-input"><img src="https://img.shields.io/npm/v/@rxova/react-otp-input?color=cb3837&logo=npm&logoColor=white" alt="npm version" /></a>
  <a href="https://github.com/rxova/react-inputs/actions/workflows/ci.yml"><img src="https://github.com/rxova/react-inputs/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI status" /></a>
  <img src="https://img.shields.io/badge/brotli-%E2%89%A4%204.5%20kB-6c5ce7" alt="Brotli size at most 4.5 kB" />
  <img src="https://img.shields.io/badge/coverage-95%25%2B-brightgreen" alt="Coverage 95% or more" />
  <img src="https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white" alt="TypeScript strict mode" />
  <img src="https://img.shields.io/badge/dependencies-0-44cc11" alt="Zero runtime dependencies" />
  <img src="https://img.shields.io/badge/React-%E2%89%A518-61dafb?logo=react&logoColor=white" alt="React 18 or newer" />
  <a href="https://github.com/rxova/react-inputs/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT license" /></a>
</p>

**A headless, accessible one-time-code input for React.** One real input underneath, real slots on
top — including the **tap-to-edit any slot** that the incumbent can't do.

```bash
npm install @rxova/react-otp-input
```

📖 **[Documentation & live examples →](https://rxova.org/packages/react-inputs/components/otp/introduction/)** — guides, form
recipes, theming, WebOTP, and migration guides from other OTP libraries.

- **One real `<input>`** — paste, SMS autofill, IME, undo, native `<form>` submission and screen-reader
  semantics all come from the platform, not from hand-rolled JavaScript
- **Tap any slot to edit it** — the input's characters sit at their true slot pitch, so a click or tap
  lands the caret where you touched, which a collapsed single-input field physically can't do
- **WebOTP** — programmatic SMS retrieval (`useWebOTP`) that no other OTP library ships
- **Headless** — zero runtime dependencies, no stylesheet to import, ~4.3 kB brotli
- **Form-ready** — string `onChange`, native `name`, and first-class React Hook Form / Formik / React
  Final Form / TanStack Form recipes
- **Correct on the seams** — formatted paste, Chrome auto-translate, IME, RTL, alphanumeric, SSR/RSC

## Basic usage

```tsx
import { useState } from 'react'
import { OtpInput } from '@rxova/react-otp-input'

function Verify() {
  const [code, setCode] = useState('')
  return (
    <OtpInput
      length={6}
      value={code}
      onChange={setCode}
      onComplete={submit}
      label="One-time code"
    />
  )
}
```

|                                       default                                        |                               grouped `123–456`                               |                                      alphanumeric                                       |
| :----------------------------------------------------------------------------------: | :---------------------------------------------------------------------------: | :-------------------------------------------------------------------------------------: |
| <img src="./assets/examples/default.png" width="230" alt="a filled six-slot code" /> | <img src="./assets/examples/grouped.png" width="230" alt="a grouped code" />  | <img src="./assets/examples/alphanumeric.png" width="230" alt="an alphanumeric code" /> |
|                                      **masked**                                      |                                  **invalid**                                  |                                     **render prop**                                     |
|      <img src="./assets/examples/masked.png" width="230" alt="a masked code" />      | <img src="./assets/examples/invalid.png" width="230" alt="an invalid code" /> | <img src="./assets/examples/render-fn.png" width="230" alt="a custom-rendered code" />  |

<img src="./assets/examples/interactive-typing.gif" width="260" alt="Typing a six-digit code" />
&nbsp;
<img src="./assets/examples/interactive-tap-edit.gif" width="260" alt="Tapping a middle slot to edit it in place" />

## Four graduated tiers

One primitive, four levels of control. Simple stays a one-liner; complex stays possible without forking.

**Tier 1** — the declarative default:

```tsx
<OtpInput length={6} value={code} onChange={setCode} label="One-time code" />
```

**Tier 2** — compound composition, for grouping and separators:

```tsx
<OtpInput length={6} value={code} onChange={setCode} label="One-time code">
  <OtpGroup>
    <OtpSlot index={0} />
    <OtpSlot index={1} />
    <OtpSlot index={2} />
  </OtpGroup>
  <OtpSeparator>–</OtpSeparator>
  <OtpGroup>
    <OtpSlot index={3} />
    <OtpSlot index={4} />
    <OtpSlot index={5} />
  </OtpGroup>
</OtpInput>
```

**Tier 3** — a render prop, when you want your own slot component:

```tsx
<OtpInput
  length={6}
  value={code}
  onChange={setCode}
  render={({ slots }) => slots.map((s) => <MySlot key={s.index} {...s} />)}
/>
```

**Tier 4** — the headless hook, to own the markup entirely:

```tsx
const otp = useOtpInput({ length: 6, value: code, onChange: setCode })
```

## Forms

`onChange` emits the sanitized **string**, and the underlying input posts natively under `name`.

With a plain `<form>`, the single input _is_ the field — just pass `name`:

```tsx
<OtpInput name="code" length={6} label="Code" />
```

With React Hook Form, Formik or React Final Form, bind `value` and `onChange` through a controlled
adapter:

```tsx
<Controller
  name="code"
  control={control}
  render={({ field }) => (
    <OtpInput
      length={6}
      label="Code"
      value={field.value}
      onChange={field.onChange}
      onBlur={field.onBlur}
      name={field.name}
      inputRef={field.ref}
    />
  )}
/>
```

Full recipes for React Hook Form, Formik, React Final Form, TanStack Form and native forms are in
the [form-library guide](https://rxova.org/packages/react-inputs/components/otp/about/#form-libraries).

## Styling

No stylesheet to import. Layout-critical CSS is inlined; everything visual is a custom property or a
`data-*` hook.

| Property                                | Default                   | Applies to                     |
| --------------------------------------- | ------------------------- | ------------------------------ |
| `--rx-otp-slot-size`                    | `2.5rem`                  | Slot width and height          |
| `--rx-otp-gap`                          | `0.5rem`                  | Space between slots            |
| `--rx-otp-font` / `-font-size`          | inherited / `1.125rem`    | Slot typography                |
| `--rx-otp-color` / `-bg`                | inherited / `transparent` | Slot foreground and background |
| `--rx-otp-border`                       | `1px solid #d4d4d8`       | Slot border                    |
| `--rx-otp-radius`                       | `0.5rem`                  | Slot corners                   |
| `--rx-otp-active-ring`                  | `2px solid Highlight`     | Ring on the active slot        |
| `--rx-otp-caret-color` / `-caret-width` | `currentColor` / `2px`    | The painted caret              |
| `--rx-otp-placeholder-color`            | inherited, dimmed         | Per-slot placeholder           |
| `--rx-otp-separator-color`              | inherited                 | `<OtpSeparator>`               |
| `--rx-otp-transition`                   | a short ease              | Slot state changes             |

### `data-*` attributes

These are **public API**, covered by semver.

| Attribute                                          | On        | Meaning                         |
| -------------------------------------------------- | --------- | ------------------------------- |
| `data-rx-otp-root`                                 | wrapper   | Always present                  |
| `data-rx-otp-input`                                | `<input>` | The single real control         |
| `data-rx-otp-group`                                | group     | `<OtpGroup>`                    |
| `data-rx-otp-slot`                                 | slot      | One painted slot                |
| `data-rx-otp-separator`                            | separator | `<OtpSeparator>`                |
| `data-rx-otp-caret`                                | caret     | The painted caret               |
| `data-state`                                       | slot      | `filled`, `active` or `empty`   |
| `data-filled` / `data-active`                      | slot      | Convenience flags for the above |
| `data-disabled` / `data-readonly` / `data-invalid` | wrapper   | Mirrors the props               |

## Keyboard

| Key                   | Effect                                                  |
| --------------------- | ------------------------------------------------------- |
| any allowed character | Fills the active slot and advances                      |
| `Backspace`           | Clears the slot, or steps back when it is already empty |
| `←` / `→`             | Move between slots                                      |
| `Home` / `End`        | Jump to the first or last slot                          |
| `Ctrl`/`Cmd` + `V`    | Paste and distribute, after `pasteTransform`            |
| `Tab`                 | Leave the field — it is one tab stop, not one per slot  |

## Accessibility

One native text `<input>` — a screen reader announces a single "one-time code, edit text", not "1 of 6"
repeated. Slots are `aria-hidden` decoration. `label` / `aria-label` name the field; `invalid` +
`aria-describedby` wire error text. Verified with axe in CI.

> **iOS note:** the default `slotInteraction="spatial"` auto-degrades to `"crush"` on iOS, which cannot
> fully hide the native `::selection`. Tap-to-edit stays keyboard-plus-caret there; it is full spatial
> everywhere else. Force either mode explicitly with the `slotInteraction` prop.

## Part of rxova

Part of the [rxova headless React inputs](https://rxova.org/packages/react-inputs/overview) suite —
install the whole set from
[`@rxova/react-inputs`](https://www.npmjs.com/package/@rxova/react-inputs), or read the full
generated [API reference](https://rxova.org/packages/react-inputs/components/otp/api) for this
package.

Migrating? `npx @rxova/codemod input-otp-to-otp --dry ./src` handles most of the move from
`input-otp`; the
[migration guide](https://rxova.org/packages/react-inputs/components/otp/migrating/) covers that and
`react-otp-input`.

## License

[MIT](https://github.com/rxova/react-inputs/blob/main/LICENSE) © rxova
