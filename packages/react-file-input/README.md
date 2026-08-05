# @rxova/react-file-input

A file picker and drop zone for React that validates, deduplicates and **revokes its own preview URLs** — and never uploads anything.

- **3.6 kB** brotli for the whole component, **2.5 kB** for the headless hook. No runtime dependencies.
- **Keyboard-first.** The drop zone is a real `<button>`, so Enter and Space open the picker. Dragging has no keyboard equivalent, so the click path _is_ the accessible path.
- **Object URLs are managed for you** — created lazily, revoked the moment a file is removed and again on unmount. This is the one thing every alternative leaves to the caller.
- **Per-file rejection reasons**: `type`, `too-large`, `too-small`, `duplicate`, `max-files`, `invalid` — with a sentence you can render as-is.
- **No network.** The library never issues a request; uploading is yours to do, with your auth, your retries and your progress.
- **95%+ coverage**, adversarial suite included, E2E on Chromium, Firefox and WebKit.
- **`onWarn`** for a logger of your choice, stripped from production builds.

```bash
pnpm add @rxova/react-file-input
```

## Usage

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

## Styling

No stylesheet ships. The component paints structure only and exposes `data-*` hooks covered by semver:

`data-rx-file-root`, `data-rx-file-input`, `data-rx-file-zone`, `data-rx-file-list`, `data-rx-file-file`, `data-rx-file-name`, `data-rx-file-size`, `data-rx-file-preview`, `data-rx-file-remove`, `data-rx-file-announcement`, plus `data-dragging`, `data-disabled`, `data-invalid` on the root.

`renderFile` replaces a whole row when the default one is not what you want; the remove button stays.

## Accessibility

- The real `<input type="file">` stays in the accessibility tree — visually hidden by clipping, never `display: none`, which would remove it from the tree and break `.click()` in some browsers.
- The drop zone is a `<button type="button">` with an explicit `tabIndex={0}`, because WebKit leaves buttons out of the tab order without Full Keyboard Access.
- Each remove button is named after its own file, not just "Remove" — a screen reader's element list shows them stripped of their row.
- After a removal, focus moves to the next file's button, or the previous one, or back to the drop zone. It never falls to `<body>`.
- Additions, removals and refusals are announced once per batch in a **polite** live region.
- Preview images are `alt=""`: the filename is right beside them.

Verified with `axe-core` at component level and `@axe-core/playwright` over the whole demo page, on all three engines.

## Diagnostics

```tsx
<FileInput label="Files" onWarn={(w) => Sentry.captureMessage(w.message, { extra: w })} />
```

Fires when a prop is coerced rather than honoured — `max-files-invalid`, `size-range-invalid`, `negative-size`, `accept-suspicious`, `single-with-max`. Deduped per instance, `console.warn` when no handler is given, and the whole path is removed from production builds (there is an E2E test asserting exactly that against the real production bundle).

## Native forms

The underlying input keeps its value, so a plain `<form>` submit posts the file with no JavaScript involved. In `multiple` mode the native control can only carry the last selection — read `value`/`onChange` if you accumulate across several picks.

## License

MIT
