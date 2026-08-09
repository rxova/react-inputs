# @rxova/react-file-input

## 1.0.0

### Major Changes

- [#63](https://github.com/rxova/react-inputs/pull/63) [`6aadf81`](https://github.com/rxova/react-inputs/commit/6aadf8109cf3ffdfecd6908daf7bdaee224b1a7a) - Release at `1.0.0`.

  This is the first version of the package that anyone can install. `0.1.0` was versioned and its
  notes written, but the release run that would have published it failed before it reached npm, so
  the number never existed as far as consumers are concerned.

  `1.0.0` also puts the package on the same number as the rest of the suite, which had drifted apart
  as an accident of merge order rather than as a statement about maturity. Nothing here changes an
  API; the entire surface is the one described in the `0.1.0` notes below.

## 0.1.0

### Minor Changes

- [#60](https://github.com/rxova/react-inputs/pull/60) [`4b038de`](https://github.com/rxova/react-inputs/commit/4b038ded8581e07bdbbb1c4eac116c95c08cfa49) - Add `autoFocus` and `aria-label`.

  `autoFocus` lands on the drop zone rather than the `<input type="file">`. The input is visually
  hidden so it can carry `name`, `accept` and `required` into a native submit; focusing it would put
  the focus ring somewhere a sighted keyboard user cannot see, on a control they are not meant to
  operate directly.

- [#60](https://github.com/rxova/react-inputs/pull/60) [`4b038de`](https://github.com/rxova/react-inputs/commit/4b038ded8581e07bdbbb1c4eac116c95c08cfa49) - Track drag depth only on `dragenter` so repeated browser `dragover` events cannot leave the drop
  zone highlighted, leave empty drops to the browser, and discard stale focus moves when a controlled
  parent refuses a removal.

- [#60](https://github.com/rxova/react-inputs/pull/60) [`4b038de`](https://github.com/rxova/react-inputs/commit/4b038ded8581e07bdbbb1c4eac116c95c08cfa49) - Add `@rxova/react-file-input`: a headless file picker and drop zone that validates, deduplicates and
  revokes its own preview URLs — and never uploads anything.

  3.5 kB brotli for the component, 2.4 kB for the `useFileInput` hook, with no runtime dependencies.
  The drop zone is a real button so the keyboard path works, the native `<input type="file">` stays in
  the accessibility tree, focus never falls to `<body>` after a removal, and every refusal reports its
  own reason (`type`, `too-large`, `too-small`, `duplicate`, `max-files`, `invalid`). Diagnostics go to
  an injectable `onWarn` logger and are stripped from production builds.

### Patch Changes

- [#60](https://github.com/rxova/react-inputs/pull/60) [`4b038de`](https://github.com/rxova/react-inputs/commit/4b038ded8581e07bdbbb1c4eac116c95c08cfa49) - Bring the README into the shape the other eight share: the badge block and centred title it never
  had, `npm install` rather than `pnpm add`, the documentation link, a `## Forms` section named like
  its siblings, and the section order the rest of the suite uses. The styling section, which was a
  run-on paragraph listing every hook in one sentence, is now the same two tables everyone else has —
  including the note that `--rx-file-list-gap` is the space _between_ files and `--rx-file-row-gap`
  the space _inside_ one row.

- [#60](https://github.com/rxova/react-inputs/pull/60) [`4b038de`](https://github.com/rxova/react-inputs/commit/4b038ded8581e07bdbbb1c4eac116c95c08cfa49) - Stop leaking a preview object URL on every StrictMode mount under React 18.

  The URLs were minted while deriving the rendered list. React 18's StrictMode mounts by rendering
  twice and keeping the second pass's hooks, so the first pass minted into a `Map` that was then
  discarded with nothing left holding it — one unrevocable URL per previewable file, every mount, each
  one pinning the whole file in memory for the lifetime of the document. React 19 did not show it, and
  the component's own StrictMode spec caught it.

  Minting and revoking now happen in an effect, which only runs for a render that committed, so each
  URL pairs with exactly one revocation by construction. Server rendering falls out of the same
  change: effects do not run there, so no URL is minted in markup that has no unmount to revoke it.

  A file's URL is still stable across re-renders and is still revoked the moment the file leaves the
  list. The one visible difference is that a preview now appears on the commit after the file is
  added rather than in the same one, which is a frame earlier than the image could have decoded
  anyway.
