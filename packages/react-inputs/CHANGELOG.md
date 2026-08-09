# @rxova/react-inputs

## 1.0.1

### Patch Changes

- Updated dependencies [[`6aadf81`](https://github.com/rxova/react-inputs/commit/6aadf8109cf3ffdfecd6908daf7bdaee224b1a7a), [`6aadf81`](https://github.com/rxova/react-inputs/commit/6aadf8109cf3ffdfecd6908daf7bdaee224b1a7a), [`6aadf81`](https://github.com/rxova/react-inputs/commit/6aadf8109cf3ffdfecd6908daf7bdaee224b1a7a), [`6aadf81`](https://github.com/rxova/react-inputs/commit/6aadf8109cf3ffdfecd6908daf7bdaee224b1a7a), [`6aadf81`](https://github.com/rxova/react-inputs/commit/6aadf8109cf3ffdfecd6908daf7bdaee224b1a7a), [`6aadf81`](https://github.com/rxova/react-inputs/commit/6aadf8109cf3ffdfecd6908daf7bdaee224b1a7a), [`6aadf81`](https://github.com/rxova/react-inputs/commit/6aadf8109cf3ffdfecd6908daf7bdaee224b1a7a)]:
  - @rxova/react-date-input@1.0.0
  - @rxova/react-file-input@1.0.0
  - @rxova/react-intl-currency-input@1.0.0
  - @rxova/react-password-input@1.0.0
  - @rxova/react-phone-input@1.0.0
  - @rxova/react-tags-input@1.0.0
  - @rxova/react-time-input@1.0.0

## 1.0.0

### Major Changes

- [#60](https://github.com/rxova/react-inputs/pull/60) [`4b038de`](https://github.com/rxova/react-inputs/commit/4b038ded8581e07bdbbb1c4eac116c95c08cfa49) - **Breaking:** the styling hooks of every component in the suite are namespaced `--rx-<name>-*` /
  `data-rx-<name>-*` — `--rx-otp-slot-size`, `--rx-rating-size`, `--rx-password-gap`,
  `--rx-date-segment-radius`, and so on. This package adds no styling of its own, but it is the
  install a stylesheet is most likely written against, so the break lands here too.

  The two components whose published names changed are `@rxova/react-otp-input` (`--otp-*`) and
  `@rxova/react-rating-input` (`--rfs-*`); see their changelogs and
  `npx @rxova/codemod rx-token-prefixes`.

  The date and time fields also now paint a focus ring on the segment that has focus. A
  `<span role="spinbutton">` gets none from the browser, and the packages previously shipped
  `outline: none` with nothing in its place, so a keyboard user could not see which segment they were
  on. Restyle it with `--rx-date-focus-ring` / `--rx-time-focus-ring` rather than removing it.

### Minor Changes

- [#60](https://github.com/rxova/react-inputs/pull/60) [`4b038de`](https://github.com/rxova/react-inputs/commit/4b038ded8581e07bdbbb1c4eac116c95c08cfa49) - Export the new date input from the all-in-one package.

- [#60](https://github.com/rxova/react-inputs/pull/60) [`4b038de`](https://github.com/rxova/react-inputs/commit/4b038ded8581e07bdbbb1c4eac116c95c08cfa49) - Export the new file input from the all-in-one package.

- [#60](https://github.com/rxova/react-inputs/pull/60) [`4b038de`](https://github.com/rxova/react-inputs/commit/4b038ded8581e07bdbbb1c4eac116c95c08cfa49) - Re-export `@rxova/react-password-input` from the suite meta-package.

- [#60](https://github.com/rxova/react-inputs/pull/60) [`4b038de`](https://github.com/rxova/react-inputs/commit/4b038ded8581e07bdbbb1c4eac116c95c08cfa49) - Export the new phone input from the all-in-one package.

- [#60](https://github.com/rxova/react-inputs/pull/60) [`4b038de`](https://github.com/rxova/react-inputs/commit/4b038ded8581e07bdbbb1c4eac116c95c08cfa49) - Export the new tags input from the all-in-one package.

- [#60](https://github.com/rxova/react-inputs/pull/60) [`4b038de`](https://github.com/rxova/react-inputs/commit/4b038ded8581e07bdbbb1c4eac116c95c08cfa49) - Export the new time input from the all-in-one package.

- [#60](https://github.com/rxova/react-inputs/pull/60) [`4b038de`](https://github.com/rxova/react-inputs/commit/4b038ded8581e07bdbbb1c4eac116c95c08cfa49) - Re-export everything the component packages export, not a hand-picked subset.

  The four packages that export by name rather than with a star were missing 37 names between them,
  and the omission had teeth: `DateInputProps.onPartsChange` is typed `(parts: DateParts) => void` and
  was re-exported while `DateParts` itself was not, so a consumer of this package could see the prop
  and had no way to name its argument. Same for `TimeParts`, `TagState`, `TagRules`, `FileRules` and
  every pure helper in those four packages.

  Exactly six names stay out, because they genuinely collide: `toISO`, `fromISO`, `compareISO` and
  `withinRange` mean different things in the date and time packages, and `attempt` / `attemptAll` in
  tags and file. `meta-package.test.ts` now fails on any export that is neither re-exported here nor
  one of those six, so the list cannot silently fall behind again.

### Patch Changes

- Updated dependencies [[`4b038de`](https://github.com/rxova/react-inputs/commit/4b038ded8581e07bdbbb1c4eac116c95c08cfa49), [`4b038de`](https://github.com/rxova/react-inputs/commit/4b038ded8581e07bdbbb1c4eac116c95c08cfa49), [`4b038de`](https://github.com/rxova/react-inputs/commit/4b038ded8581e07bdbbb1c4eac116c95c08cfa49), [`4b038de`](https://github.com/rxova/react-inputs/commit/4b038ded8581e07bdbbb1c4eac116c95c08cfa49), [`4b038de`](https://github.com/rxova/react-inputs/commit/4b038ded8581e07bdbbb1c4eac116c95c08cfa49), [`4b038de`](https://github.com/rxova/react-inputs/commit/4b038ded8581e07bdbbb1c4eac116c95c08cfa49), [`4b038de`](https://github.com/rxova/react-inputs/commit/4b038ded8581e07bdbbb1c4eac116c95c08cfa49), [`4b038de`](https://github.com/rxova/react-inputs/commit/4b038ded8581e07bdbbb1c4eac116c95c08cfa49), [`4b038de`](https://github.com/rxova/react-inputs/commit/4b038ded8581e07bdbbb1c4eac116c95c08cfa49), [`4b038de`](https://github.com/rxova/react-inputs/commit/4b038ded8581e07bdbbb1c4eac116c95c08cfa49), [`4b038de`](https://github.com/rxova/react-inputs/commit/4b038ded8581e07bdbbb1c4eac116c95c08cfa49), [`4b038de`](https://github.com/rxova/react-inputs/commit/4b038ded8581e07bdbbb1c4eac116c95c08cfa49), [`4b038de`](https://github.com/rxova/react-inputs/commit/4b038ded8581e07bdbbb1c4eac116c95c08cfa49), [`4b038de`](https://github.com/rxova/react-inputs/commit/4b038ded8581e07bdbbb1c4eac116c95c08cfa49), [`4b038de`](https://github.com/rxova/react-inputs/commit/4b038ded8581e07bdbbb1c4eac116c95c08cfa49), [`4b038de`](https://github.com/rxova/react-inputs/commit/4b038ded8581e07bdbbb1c4eac116c95c08cfa49), [`4b038de`](https://github.com/rxova/react-inputs/commit/4b038ded8581e07bdbbb1c4eac116c95c08cfa49), [`4b038de`](https://github.com/rxova/react-inputs/commit/4b038ded8581e07bdbbb1c4eac116c95c08cfa49), [`4b038de`](https://github.com/rxova/react-inputs/commit/4b038ded8581e07bdbbb1c4eac116c95c08cfa49), [`4b038de`](https://github.com/rxova/react-inputs/commit/4b038ded8581e07bdbbb1c4eac116c95c08cfa49), [`4b038de`](https://github.com/rxova/react-inputs/commit/4b038ded8581e07bdbbb1c4eac116c95c08cfa49), [`4b038de`](https://github.com/rxova/react-inputs/commit/4b038ded8581e07bdbbb1c4eac116c95c08cfa49), [`4b038de`](https://github.com/rxova/react-inputs/commit/4b038ded8581e07bdbbb1c4eac116c95c08cfa49), [`4b038de`](https://github.com/rxova/react-inputs/commit/4b038ded8581e07bdbbb1c4eac116c95c08cfa49), [`4b038de`](https://github.com/rxova/react-inputs/commit/4b038ded8581e07bdbbb1c4eac116c95c08cfa49), [`4b038de`](https://github.com/rxova/react-inputs/commit/4b038ded8581e07bdbbb1c4eac116c95c08cfa49), [`4b038de`](https://github.com/rxova/react-inputs/commit/4b038ded8581e07bdbbb1c4eac116c95c08cfa49), [`4b038de`](https://github.com/rxova/react-inputs/commit/4b038ded8581e07bdbbb1c4eac116c95c08cfa49), [`4b038de`](https://github.com/rxova/react-inputs/commit/4b038ded8581e07bdbbb1c4eac116c95c08cfa49), [`4b038de`](https://github.com/rxova/react-inputs/commit/4b038ded8581e07bdbbb1c4eac116c95c08cfa49), [`4b038de`](https://github.com/rxova/react-inputs/commit/4b038ded8581e07bdbbb1c4eac116c95c08cfa49)]:
  - @rxova/react-phone-input@0.1.0
  - @rxova/react-intl-currency-input@0.3.0
  - @rxova/react-date-input@0.1.0
  - @rxova/react-file-input@0.1.0
  - @rxova/react-time-input@0.1.0
  - @rxova/react-otp-input@1.0.0
  - @rxova/react-password-input@0.1.0
  - @rxova/react-tags-input@0.1.0
  - @rxova/react-rating-input@1.0.0

## 0.1.5

### Patch Changes

- Updated dependencies [[`e7f4f90`](https://github.com/rxova/react-inputs/commit/e7f4f90477bfb27310102d2c9ab3d92c34a7c4b4)]:
  - @rxova/react-intl-currency-input@0.2.0

## 0.1.4

### Patch Changes

- [#53](https://github.com/rxova/react-inputs/pull/53) [`8ee31e1`](https://github.com/rxova/react-inputs/commit/8ee31e1ce842c93c0e171a1926822695122a4fda) - Ship an `llms.txt` in the package, pointing at each component's own. Coding agents read `node_modules` after an install, so this is where to say that the meta-package and the individual packages are equivalent under `sideEffects: false`, and that the three components deliberately do not share a value convention — `number | null`, `number` and `string` respectively.

- Updated dependencies [[`8ee31e1`](https://github.com/rxova/react-inputs/commit/8ee31e1ce842c93c0e171a1926822695122a4fda), [`8ee31e1`](https://github.com/rxova/react-inputs/commit/8ee31e1ce842c93c0e171a1926822695122a4fda), [`8ee31e1`](https://github.com/rxova/react-inputs/commit/8ee31e1ce842c93c0e171a1926822695122a4fda)]:
  - @rxova/react-intl-currency-input@0.1.6
  - @rxova/react-otp-input@0.1.7
  - @rxova/react-rating-input@0.2.5

## 0.1.3

### Patch Changes

- [#13](https://github.com/rxova/react-inputs/pull/13) [`efc7bba`](https://github.com/rxova/react-inputs/commit/efc7bba37136fc1ec7e4dd5af0070870bc0d29ba) - Fix the README links to the per-component documentation pages, which 404'd
  after the docs site was restructured.
- Updated dependencies [[`efc7bba`](https://github.com/rxova/react-inputs/commit/efc7bba37136fc1ec7e4dd5af0070870bc0d29ba), [`efc7bba`](https://github.com/rxova/react-inputs/commit/efc7bba37136fc1ec7e4dd5af0070870bc0d29ba), [`efc7bba`](https://github.com/rxova/react-inputs/commit/efc7bba37136fc1ec7e4dd5af0070870bc0d29ba)]:
  - @rxova/react-intl-currency-input@0.1.3
  - @rxova/react-otp-input@0.1.2
  - @rxova/react-rating-input@0.2.2

## 0.1.2

### Patch Changes

- [`52a71be`](https://github.com/rxova/react-inputs/commit/52a71be1cacad59dafff8b3951cbc15bf4b2fd88) - Add the currency input package logo and refresh the Rxova React Inputs documentation.

- Updated dependencies [[`52a71be`](https://github.com/rxova/react-inputs/commit/52a71be1cacad59dafff8b3951cbc15bf4b2fd88)]:
  - @rxova/react-intl-currency-input@0.1.2

## 0.1.1

### Patch Changes

- [`f5dd58c`](https://github.com/rxova/react-inputs/commit/f5dd58c91d6aeef8cb7aa83d51e21a55f91326f9) Correct the published README and package metadata after the move into the rxova monorepo.

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

- Updated dependencies [[`f5dd58c`](https://github.com/rxova/react-inputs/commit/f5dd58c91d6aeef8cb7aa83d51e21a55f91326f9)]:
  - @rxova/react-intl-currency-input@0.1.1
  - @rxova/react-rating-input@0.2.1
  - @rxova/react-otp-input@0.1.1
