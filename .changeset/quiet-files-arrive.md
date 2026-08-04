---
'@rxova/react-file-input': minor
---

Add `@rxova/react-file-input`: a headless file picker and drop zone that validates, deduplicates and
revokes its own preview URLs — and never uploads anything.

3.5 kB brotli for the component, 2.4 kB for the `useFileInput` hook, with no runtime dependencies.
The drop zone is a real button so the keyboard path works, the native `<input type="file">` stays in
the accessibility tree, focus never falls to `<body>` after a removal, and every refusal reports its
own reason (`type`, `too-large`, `too-small`, `duplicate`, `max-files`, `invalid`). Diagnostics go to
an injectable `onWarn` logger and are stripped from production builds.
