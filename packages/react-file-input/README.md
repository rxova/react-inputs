<h1 align="center">@rxova/react-file-input</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/@rxova/react-file-input"><img src="https://img.shields.io/npm/v/@rxova/react-file-input?color=cb3837&logo=npm&logoColor=white" alt="npm version" /></a>
  <a href="https://github.com/rxova/react-inputs/actions/workflows/ci.yml"><img src="https://github.com/rxova/react-inputs/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI status" /></a>
  <img src="https://img.shields.io/badge/brotli-%E2%89%A4%204%20kB-f5a623" alt="Brotli size at most 4 kB" />
  <img src="https://img.shields.io/badge/coverage%20threshold-95%25-brightgreen" alt="Coverage threshold: 95% per file" />
  <img src="https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white" alt="TypeScript strict mode" />
  <img src="https://img.shields.io/badge/dependencies-0-44cc11" alt="Zero runtime dependencies" />
  <img src="https://img.shields.io/badge/React-%E2%89%A518-61dafb?logo=react&logoColor=white" alt="React 18 or newer" />
  <a href="https://github.com/rxova/react-inputs/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT license" /></a>
</p>

**A file picker and drop zone that validates, deduplicates and revokes its own preview URLs — and
never uploads anything.** Headless, zero-dependency.

```bash
npm install @rxova/react-file-input
```

📖 **[Documentation & live examples →](https://rxova.org/packages/react-inputs/components/file/introduction/)** — guides, form recipes, theming, the object-URL lifecycle, and migration from another upload library.

- **3.6 kB** brotli for the whole component, **2.5 kB** for the headless hook. No runtime dependencies.
- **Keyboard-first.** The drop zone is a real `<button>`, so Enter and Space open the picker. Dragging has no keyboard equivalent, so the click path _is_ the accessible path.
- **Object URLs are managed for you** — created lazily, revoked the moment a file is removed and again on unmount. This is the one thing every alternative leaves to the caller.
- **Per-file rejection reasons**: `type`, `too-large`, `too-small`, `duplicate`, `max-files`, `invalid` — with a sentence you can render as-is.
- **No network.** The library never issues a request; uploading is yours to do, with your auth, your retries and your progress.
- **Adversarial suite included**, and E2E on Chromium, Firefox and WebKit.
- **`onWarn`** for a logger of your choice, stripped from production builds.

## Basic use

```tsx
import { useState } from 'react'
import { FileInput, describeRejection } from '@rxova/react-file-input'

function Attachments() {
  const [files, setFiles] = useState<File[]>([])
  return (
    <FileInput
      label="Attachments"
      name="attachments"
      multiple
      accept=".pdf,image/*"
      maxSize={5_000_000}
      maxFiles={5}
      previews
      value={files}
      onChange={setFiles}
      onReject={(attempt) => {
        toast(describeRejection(attempt, { maxSize: 5_000_000 }))
      }}
    />
  )
}
```

Uncontrolled works too — omit `value`/`onChange` and pass `defaultValue`.

## Rules

| Prop                  | What it does                                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `accept`              | Exactly the native `accept` grammar: `.ext`, `type/sub`, `type/*`. Lenient when the browser reports no MIME type at all. |
| `maxSize` / `minSize` | Bytes. An inverted range is ignored rather than enforced (and warned about).                                             |
| `maxFiles`            | Ignored unless `multiple`. A single-file field is always capped at one.                                                  |
| `dedupe`              | On by default. Identity is name + size + last-modified, like the native control.                                         |
| `validate`            | Final say. Return `true`, `false`, or a string that becomes the rejection message.                                       |

Every refusal reaches `onReject` with the file and a machine-readable `reason`, one call per file, so a selection of five where two fail still adds the other three.

## Previews

`previews` opts into the object-URL lifecycle:

```tsx
<FileInput label="Photos" multiple previews accept="image/*" />
```

URLs are minted only for images, only on the client, and revoked as soon as the file leaves the list — add and remove ten 5 MB photos and nothing is retained. It is off by default because a URL nobody revokes is a memory leak, and the caller should opt into the lifecycle deliberately.

## Forms

The underlying input keeps its value, so a plain `<form>` submit posts the file with no JavaScript involved. In `multiple` mode the native control can only carry the last selection — read `value`/`onChange` if you accumulate across several picks.

## Styling

There is no stylesheet to import. Only layout-critical declarations are inlined; everything visual
is a CSS custom property or a `data-*` hook.

| Property                    | Default                   | Applies to                    |
| --------------------------- | ------------------------- | ----------------------------- |
| `--rx-file-gap`             | `0.5rem`                  | Between the zone and the list |
| `--rx-file-zone-gap`        | `0.5rem`                  | Inside the drop zone          |
| `--rx-file-zone-padding`    | `1rem`                    | Drop zone padding             |
| `--rx-file-zone-border`     | `1px dashed currentColor` | Drop zone border              |
| `--rx-file-zone-radius`     | `0.375rem`                | Drop zone corners             |
| `--rx-file-zone-background` | `transparent`             | Drop zone background          |
| `--rx-file-list-gap`        | `0.25rem`                 | Space _between_ files         |
| `--rx-file-row-gap`         | `0.5rem`                  | Space _inside_ one row        |
| `--rx-file-preview-size`    | `2.5rem`                  | Thumbnail size                |
| `--rx-file-preview-radius`  | `0.25rem`                 | Thumbnail corners             |
| `--rx-file-remove-size`     | `1.5rem`                  | Remove button hit area        |

Do not shrink `--rx-file-remove-size` below `1.5rem`: at the default font size that is the 24×24 CSS
pixels WCAG 2.5.8 Target Size (Minimum) requires.

### `data-*` attributes

These are **public API**, covered by semver.

| Attribute                                          | On                    | Meaning                           |
| -------------------------------------------------- | --------------------- | --------------------------------- |
| `data-rx-file-root`                                | wrapper               | Always present                    |
| `data-dragging`                                    | wrapper               | A drag is over the zone           |
| `data-count` / `data-full`                         | wrapper               | File count, and `maxFiles` hit    |
| `data-invalid` / `data-disabled` / `data-readonly` | wrapper               | Mirrors the props                 |
| `data-rx-file-input`                               | `<input type="file">` | The real control, visually hidden |
| `data-rx-file-zone`                                | `<button>`            | The drop zone                     |
| `data-rx-file-list`                                | `<ul>`                | The selection                     |
| `data-rx-file-file`                                | `<li>`                | One file row                      |
| `data-rx-file-name` / `data-rx-file-size`          | row                   | Name and human-readable size      |
| `data-rx-file-preview`                             | `<img>`               | Only when `previews` is on        |
| `data-rx-file-remove`                              | `<button>`            | The remove button                 |
| `data-rx-file-announcement`                        | live region           | Off-screen, `aria-live="polite"`  |

`renderFile` replaces a whole row when the default one is not what you want; the remove button stays.

## Headless

`useFileInput` gives you the state and the handlers with no markup at all:

```tsx
import { useFileInput } from '@rxova/react-file-input'

function CustomDropZone() {
  const field = useFileInput({ multiple: true, previews: true, maxSize: 1_000_000 })

  return (
    <div
      ref={field.zoneRef}
      onDragOver={field.handleDragOver}
      onDragLeave={field.handleDragLeave}
      onDrop={field.handleDrop}
      data-dragging={field.dragging || undefined}
    >
      <input type="file" ref={field.inputRef} multiple onChange={field.handleInputChange} />
      <button type="button" onClick={field.open}>
        Choose files
      </button>
      {field.entries.map((entry, index) => (
        <button
          key={entry.key}
          type="button"
          aria-label={`Remove ${entry.file.name}`}
          onClick={() => {
            field.removeAt(index)
          }}
        >
          <img src={entry.preview} alt="" />
          {field.sizeOf(entry.file)}
        </button>
      ))}
    </div>
  )
}
```

The fiddly parts — the drag-depth counter, the URL revocation, the focus handoff after a removal — live in the hook, not the component.

## Diagnostics

```tsx
<FileInput label="Files" onWarn={(w) => Sentry.captureMessage(w.message, { extra: w })} />
```

Fires when a prop is coerced rather than honoured — `max-files-invalid`, `size-range-invalid`, `negative-size`, `accept-suspicious`, `single-with-max`. Deduped per instance, `console.warn` when no handler is given, and the whole path is removed from production builds (there is an E2E test asserting exactly that against the real production bundle).

## Accessibility

- The real `<input type="file">` stays in the accessibility tree — visually hidden by clipping, never `display: none`, which would remove it from the tree and break `.click()` in some browsers.
- The drop zone is a `<button type="button">` with an explicit `tabIndex={0}`, because WebKit leaves buttons out of the tab order without Full Keyboard Access.
- Each remove button is named after its own file, not just "Remove" — a screen reader's element list shows them stripped of their row.
- After a removal, focus moves to the next file's button, or the previous one, or back to the drop zone. It never falls to `<body>`.
- Additions, removals and refusals are announced once per batch in a **polite** live region.
- Preview images are `alt=""`: the filename is right beside them.

Verified with `axe-core` at component level and `@axe-core/playwright` over the whole demo page, on all three engines.

## Part of rxova

Part of the [rxova headless React inputs](https://rxova.org/packages/react-inputs/overview) suite —
install the whole set from
[`@rxova/react-inputs`](https://www.npmjs.com/package/@rxova/react-inputs), or read the full
generated [API reference](https://rxova.org/packages/react-inputs/components/file/api) for this package.

Cross-cutting guidance lives on this component's About page:
[styling](https://rxova.org/packages/react-inputs/components/file/about/#styling) and [form libraries](https://rxova.org/packages/react-inputs/components/file/about/#form-libraries). Coming from
another library? The [migration guide](https://rxova.org/packages/react-inputs/components/file/migrating/) maps the props across.

## License

[MIT](https://github.com/rxova/react-inputs/blob/main/LICENSE) © rxova
