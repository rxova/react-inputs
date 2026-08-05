# Considerations — `@rxova/react-file-input`

Decisions I made without asking, and why. Each is reversible; flag any you disagree with.

## Naming and placement

- **`@rxova/react-file-input`**, matching the sibling packages. Not "dropzone" or "uploader": it
  is a _field_, it participates in a form, and it uploads nothing.
- Component `FileInput`, hook `useFileInput`, `data-rx-file-*` attributes, warning prefix
  `[react-file-input]`, demo on ports 5283/4183 — the next free slot in the repo's sequence.
- Pure helpers (`attempt`, `attemptAll`, `matchesAccept`, `formatBytes`, `describeRejection`,
  `fileKey`, `extensionOf`, `isPreviewable`) are exported. They are useful for server-side
  revalidation of the same rules, and testing them directly is cheaper than through the DOM.

## The accessible shape

- **The drop zone is a `<button type="button">`, not a `div`.** Dragging has no keyboard
  equivalent, so the click path is the only accessible path; a button supplies Enter, Space, focus
  and a role for free.
- **The real `<input type="file">` stays in the DOM**, hidden by the visually-hidden clip
  technique. `display: none` or the `hidden` attribute would take it out of the accessibility tree
  and, in some browsers, stop `.click()` opening the picker.
- **Explicit `tabIndex={0}`** on the drop zone and every remove button: WebKit omits buttons from
  sequential navigation unless Full Keyboard Access is on.
- **Focus after a removal** goes to the next file's button, else the previous, else the drop zone.
- **The list is a `<ul>`**, so a screen reader announces "list, 3 items".
- **Remove buttons are named after their file** — `Remove invoice.pdf`, overridable via
  `removeLabel`.
- **Previews are `alt=""`.** The filename is right beside them; alt text would be read twice.
- **One polite announcement per batch.** Attaching four files says so once, not four times.
- Remove buttons are laid out at 24×24 CSS pixels minimum (WCAG 2.5.8), asserted in both the
  component and the page-level suites.

## Rules and rejection

- **Identity is `name:size:lastModified`**, matching what the native control treats as the same
  file. Content hashing would be correct and would also mean reading every byte of every file.
- **`accept` is lenient when the browser reports no MIME type.** Some platforms hand over an empty
  `type` for perfectly ordinary files; refusing those would be worse than occasionally admitting
  one, and the extension check still applies.
- **Sizes are decimal** (`1 kB` = 1000 bytes), which is what every operating system's file browser
  shows the user.
- **Unusable bounds are dropped, not enforced.** `maxFiles: 0`, a negative `minSize`, an inverted
  size range — each is ignored and reported through `onWarn`. A field that can never accept
  anything is a bug in the caller's code, not a state worth rendering.
- **`validate` is contained.** A throwing validator refuses that one file and warns; it never
  unmounts the form.
- **A refused file leaves the rest alone.** Five picked, two refused, three added — with one
  `onReject` call each.
- **A single-file field replaces rather than appends**, because the native control holds one file
  and showing two would misreport what a submit would post.

## Previews

- **Off by default.** An object URL nobody revokes is a memory leak; opting in should be a
  deliberate act.
- **Images only.** Everything else has no meaningful thumbnail without decoding it.
- **Never minted on the server.** There is no unmount during server rendering, so such a URL could
  never be revoked — and it would be meaningless in the HTML anyway.
- The URL map is _mutated_, never replaced: the unmount cleanup captures it once, and swapping in
  a fresh map would leave that cleanup holding an empty one. (This was a real bug, caught by the
  adversarial suite.)

## Props and value

- **The value is `File[]`**, never a wrapper object. `File` is the thing `FormData` and `fetch`
  take, and inventing `{ id, file, status }` would make every consumer unwrap it.
- **Controlled and uncontrolled both supported**, `value` winning when present.
- **The native input value is cleared on removal and on `clear()`, but not after a pick.** Blanking
  it after every pick is the usual trick for "let the user re-pick the same file", but it also
  empties the control a native form submit posts — the field would then render a file the server
  never receives.
- **No stylesheet.** Structural inline styles only, with `data-*` hooks covered by semver, matching
  the rest of the repo.
- **`renderFile` replaces a row but keeps the remove button**, so a custom renderer cannot
  accidentally drop the only way to detach a file.

## Testing

- Coverage is enforced **per file** at 95%. `/* v8 ignore */` appears three times, each on a
  genuinely unreachable branch (`noUncheckedIndexedAccess` fallbacks, the production-stripped
  diagnostics body) and each with a comment saying why.
- The adversarial suite drives the failure modes on purpose: throwing callbacks, unmounting
  mid-drag, duplicate picks, the URL leak, two fields on one page, a `dragleave` from a child.
- E2E runs 28 specs on Chromium, Firefox and WebKit against a **production** demo build. One of
  them asserts the diagnostics path is absent from that bundle.
- Where an engine cannot express something (synthesising a file `DataTransfer`), the test
  `test.skip()`s **visibly** rather than passing quietly.

## Known limitations

- **Dedupe across two separate picks cannot be exercised through Playwright's `setInputFiles`**,
  which stamps each uploaded buffer with the current time — so the same file picked twice is
  genuinely two files. That path is covered through the drop event instead.
- **In `multiple` mode a native form submit posts only the last selection**, because the native
  control can hold only what the last pick gave it. Read `value`/`onChange` if you accumulate.
- **No directory drops.** `DataTransferItem.webkitGetAsEntry` traversal is uneven across engines
  and unbounded in depth.
- **No upload, progress or retry.** Out of scope by design — see the manifest.
