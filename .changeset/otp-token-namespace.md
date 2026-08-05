---
'@rxova/react-otp-input': major
---

**Breaking:** every CSS custom property and `data-*` hook is now namespaced `--rx-otp-*` /
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
