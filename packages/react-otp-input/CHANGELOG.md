# @rxova/react-otp-input

## 1.0.1

### Patch Changes

- [#70](https://github.com/rxova/react-inputs/pull/70) [`111bf02`](https://github.com/rxova/react-inputs/commit/111bf0202f3a8787eedea28b128fe33ed1e05ee0) - Broaden the npm keywords

  Adds `otp-input`, `one-time-password`, `sms-code`, `code-input`, `pin-input` and
  `passcode` — one problem with six names, and the package answered to two of them
  — plus `autocomplete-one-time-code`, the attribute somebody lands here searching
  for when autofill is not working. No code changes.

## 1.0.0

### Major Changes

- [#60](https://github.com/rxova/react-inputs/pull/60) [`4b038de`](https://github.com/rxova/react-inputs/commit/4b038ded8581e07bdbbb1c4eac116c95c08cfa49) - **Breaking:** every CSS custom property and `data-*` hook is now namespaced `--rx-otp-*` /
  `data-rx-otp-*`. `--otp-slot-size` becomes `--rx-otp-slot-size`, `[data-otp-root]` becomes
  `[data-rx-otp-root]`, and so on for all fourteen properties and six attributes. The shared state
  hooks — `data-state`, `data-filled`, `data-active`, `data-disabled`, `data-readonly`,
  `data-invalid` — are unchanged, because they mean the same thing on every input in the suite and
  one selector should reach all of them.

  Run `npx @rxova/codemod rx-token-prefixes` over your components, and the `sed` line in the
  migration guide over your stylesheets.

  The old scheme was each package's initials, which does not survive nine components: password and
  phone both reduce to `rpi`, rating and file both to `rf?`. Custom properties inherit, so setting
  the wrong one is silently inert rather than an error — the knob just does nothing, on a component
  that looks like it should have it. `pnpm check:tokens` now fails a hook that leaves its component's
  namespace, so this cannot drift back.

- [#60](https://github.com/rxova/react-inputs/pull/60) [`4b038de`](https://github.com/rxova/react-inputs/commit/4b038ded8581e07bdbbb1c4eac116c95c08cfa49) - Rename the caret class and the injected keyframes/style element from `otp-slots-*` to `rx-otp-*`,
  and fix the development warnings, which announced themselves as `react-otp-slots:` — a package name
  this has not had for some time, in a format none of its siblings use. They now read
  `[react-otp-input]`, like every other package in the suite.

  The class name is undocumented and the style element is an implementation detail, but both land in
  the DOM, so a stylesheet targeting `.otp-slots-caret` needs updating. Grouped with the 1.0 token
  rename because it is the same change of identity, landing in the same release.

### Patch Changes

- [#60](https://github.com/rxova/react-inputs/pull/60) [`4b038de`](https://github.com/rxova/react-inputs/commit/4b038ded8581e07bdbbb1c4eac116c95c08cfa49) - Keep rapid keyboard input in order when it starts immediately after a pointer click. Deferred
  spatial caret placement is now cancelled as soon as keyboard, paste, autofill or composition input
  begins, so a busy browser cannot move the caret midway through a code.

## 0.1.7

### Patch Changes

- [#53](https://github.com/rxova/react-inputs/pull/53) [`8ee31e1`](https://github.com/rxova/react-inputs/commit/8ee31e1ce842c93c0e171a1926822695122a4fda) - Ship an `llms.txt` in the package. Coding agents read `node_modules` after an install, so this puts the install line, a working example, the full prop table, the CSS custom properties and the `data-*` hooks where they will actually be found — along with the three mistakes this component attracts, chief among them rendering one `<input>` per slot, which is the pattern it exists to avoid.

## 0.1.6

### Patch Changes

- [#42](https://github.com/rxova/react-inputs/pull/42) [`8eb69b6`](https://github.com/rxova/react-inputs/commit/8eb69b6d122a6ae72699a16165c598789bb24625) - Clicks now land the caret in the slot that was actually pressed, everywhere in the slot. The browser's own click-to-caret mapping broke down at the edges: a press on a slot's top or bottom border fell outside the invisible text's line box and mapped to the first slot, a full field scrolls by the trailing letter-spacing and shifted edge clicks into the next slot, and a separator pushed the second group off the uniform glyph pitch. The caret is now placed geometrically from the pressed point against the rendered slot rects, settling a frame after the click so Chrome's late selection collapse (which fires no `select` event) can't undo it.

## 0.1.5

### Patch Changes

- [#40](https://github.com/rxova/react-inputs/pull/40) [`1b1872e`](https://github.com/rxova/react-inputs/commit/1b1872e55bb7ccc262fddbf9c93830d56bf557e2) - Typing over a full code now works: a collapsed caret inside a complete value expands into a one-character selection over its slot (arrow keys walk it, pointer presses land it), so the next key replaces that character instead of being swallowed by `maxLength`. Keyboard focus now also parks the caret deterministically — on the first empty slot, or over the last character when the code is full — instead of wherever the browser drops it, and a disallowed key can no longer delete the character it was typed over.

## 0.1.4

### Patch Changes

- [#36](https://github.com/rxova/react-inputs/pull/36) [`7fc0751`](https://github.com/rxova/react-inputs/commit/7fc07514431fb245ac2468c4cd683fd2293d7478) - Focusing the field with a pointer press no longer flashes a stale slot active before the pressed one: the focus state now commits after the browser has placed the caret, in a single render.

## 0.1.3

### Patch Changes

- [#15](https://github.com/rxova/react-inputs/pull/15) [`7fc9910`](https://github.com/rxova/react-inputs/commit/7fc9910538a95983882f95324d7aaa2fdb75a7d9) - Declare the package in its own manifest (`rxova.slug`, `label`, `title`) so
  the docs sidebar, the CI matrices and the playground discover it instead of
  repeating it in a list each. No runtime change.

## 0.1.2

### Patch Changes

- [#13](https://github.com/rxova/react-inputs/pull/13) [`efc7bba`](https://github.com/rxova/react-inputs/commit/efc7bba37136fc1ec7e4dd5af0070870bc0d29ba) - Point the README and `homepage` at the routes the docs site actually serves.
  The Docusaurus-era `/packages/react-inputs/otp` landing route and the shared
  `/guides/*` pages were removed when the docs were restructured per component,
  so every documentation link on the npm page 404'd.

## 0.1.1

### Patch Changes

- [`f5dd58c`](https://github.com/rxova/react-inputs/commit/f5dd58c91d6aeef8cb7aa83d51e21a55f91326f9) - Correct the published README and package metadata after the move into the rxova monorepo.

  The README shown on npm is served from the published tarball, so these fixes required a release:

  - **Install commands and imports named the pre-migration packages.** The READMEs told users to
    install `react-feedback-stars`, `react-otp-slots` and `react-intl-currency-input`, and imported
    from those specifiers, none of which are the published names. They now use the `@rxova/*` names.
  - **Documentation links were dead.** Every `rxova.github.io/react-*` link, plus the `/recipes/*` and
    `/playground` routes, returned 404. They now point at the live docs on
    `rxova.org/packages/react-inputs`.
  - **CI badges pointed at the pre-migration repositories**, so they showed either a 404 image or the
    status of an archived repo. They now report this repository's CI.
  - **`homepage` in each manifest pointed at `rxova.github.io/react-inputs/…`**, which is not served —
    this is the "Homepage" link on the npm page. It now points at the live docs.
  - Added npm version badges, and documented each package's place in the suite.

  No runtime code changed in these packages; `dist` output is identical.
