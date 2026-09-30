# Contributing

Thanks for taking the time to contribute.

## Architecture

A pnpm + Turborepo monorepo: several published packages, one shared playground, and one shared
docs site.

| Path                                  | What lives there                                                                     |
| ------------------------------------- | ------------------------------------------------------------------------------------ |
| `packages/react-intl-currency-input/` | `@rxova/react-intl-currency-input` — locale-aware currency input.                    |
| `packages/react-rating-input/`        | `@rxova/react-rating-input` — rating input (stars / any icon).                       |
| `packages/react-otp-input/`           | `@rxova/react-otp-input` — OTP / one-time-code input.                                |
| `packages/react-phone-input/`         | `@rxova/react-phone-input` — international phone input.                              |
| `packages/react-password-input/`      | `@rxova/react-password-input` — password input, strength meter, reveal toggle.       |
| `packages/react-date-input/`          | `@rxova/react-date-input` — segmented date field, no calendar.                       |
| `packages/react-time-input/`          | `@rxova/react-time-input` — segmented time field, no popup.                          |
| `packages/react-tags-input/`          | `@rxova/react-tags-input` — tag / token input.                                       |
| `packages/react-file-input/`          | `@rxova/react-file-input` — file picker and drop zone (no uploading).                |
| `packages/react-inputs/`              | `@rxova/react-inputs` — meta-package that re-exports the whole suite.                |
| `packages/codemod/`                   | `@rxova/codemod` — jscodeshift codemods (one transform per migration) for the suite. |
| `scripts/`                            | Repo-specific checks (component registry, token namespaces, e2e browser list).       |
| `packages/*/src/__tests__/`           | `*.test.ts(x)` run in node, `*.browser.test.tsx` run in Chromium.                    |
| `packages/*/e2e/`                     | Playwright specs, per package, against the built shared playground.                  |
| `apps/playground/`                    | `@rxova/playground` — Vite app for manual QA and the E2E target.                     |
| `apps/docs/`                          | `@rxova/docs` — Astro Starlight site for the whole suite.                            |

Each component package follows the same shape: pure logic modules with no React, a headless
`use*` hook holding state, a thin rendering component, a `types.ts` public prop surface, and
tests. `types.ts` and the `data-*` attributes listed in each README are public API, covered by
semver.

## Setup

Requirements:

- **Developing this repo: Node `>= 22.13`** (see `.nvmrc`, pinned to 24). This is a pnpm
  constraint — pnpm 11 imports `node:sqlite` and crashes on older Node.
- **Using the published packages: Node `>= 20.19`** (`engines.node`). CI still runs the unit
  suites on Node 20 so the support claim stays tested rather than assumed.
- pnpm, pinned via `packageManager` in `package.json`.

```bash
pnpm install
pnpm run e2e:install                    # browsers for the E2E and browser suites
pnpm dev                                # shared playground on :5173
```

## Commands

Orchestrated by Turborepo, so tasks run in dependency order and cache across packages.

```bash
pnpm build             # turbo run build — every package, ^build ordered
pnpm test              # unit + browser suites across packages
pnpm test:coverage     # enforces 95% per file
pnpm e2e               # Playwright per package, max three suites at once
pnpm e2e:serial        # Same suites, one package at a time for constrained machines
pnpm lint / typecheck / format
pnpm size              # bundle-size budgets
pnpm check:exports     # publint + attw
```

Scope to one package with a filter: `pnpm --filter @rxova/react-otp-input test:browser`.

### Which suite does a test belong in?

- **Pure logic / arithmetic** → `src/__tests__/*.test.ts`, node project. Fast, no DOM.
- **Geometry, clipping, hover, focus, caret, paste** → `*.browser.test.tsx`, Chromium. jsdom has
  no layout engine and a fictional selection model, so a jsdom assertion there only re-reads the
  style string we just wrote. Never add jsdom for these.
- **Server rendering** → `src/__tests__/ssr.test.tsx`, node project.
- **Anything that needs a whole page** — tab order across several fields, a real form round-trip,
  page-level RTL, axe over the full document → the package's `e2e/`. This layer catches things
  component tests structurally cannot.

## Pre-PR checklist

`pnpm verify` runs the steps in `repoConfig.verify` (root `package.json`) in order, and CI runs the
same checks through the reusable workflows in [rxova/shared](https://github.com/rxova/shared):

1. `audit:check` · `dedupe:check` · `sherif:check` · `knip:check`
2. `format:check` · `check:snippets` · `check:llms` · `check:tokens` · `check:browsers` · `lint`
3. `typecheck` · `test:coverage` — **95% per file** (the `@rxova/repo-config/vitest` preset), so a
   new file with thin tests fails even if the repo average is fine · `build` · `size`
4. `check:exports` (publint + attw) · `pack:smoke` (`rxova-repo-config pack-smoke` for every
   published package; the codemod's bin and transform run from its `repoConfig.packSmoke`)

CI adds what `verify` leaves out: the unit suites on Node 22, 24 and 26, the packages on their
`engines` floor, React 18, `e2e` in all three engines and the framework harnesses.

The shared setup, in one place:

| What                                                                                                             | From                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `verify`, `check-changeset`, `check-llms`, `check-snippets`, `pack-smoke`, `post-publish-smoke`, `list-packages` | `@rxova/repo-config` (the `rxova-repo-config` bin), configured under `repoConfig` in the root `package.json` |
| ESLint, Prettier, lint-staged, commitlint, changelog, knip, the tsconfig base                                    | `@rxova/repo-config` presets                                                                                 |
| Each package's `tsdown`, `vitest` and `playwright` config                                                        | `reactBuildConfig` / `dualBuildConfig`, `baseVitestConfig`, `basePlaywrightConfig`                           |
| The docs site's `.md` twins, `llms.txt`, `llms-full.txt` and their build check                                   | `@rxova/docs-kit`                                                                                            |
| CI jobs and the setup actions                                                                                    | `rxova/shared` reusable workflows and actions, at `@main`                                                    |
| Renovate                                                                                                         | `github>rxova/shared//renovate/default.json5`                                                                |

Only `scripts/` (the token-namespace and e2e browser-list checks, the component registry) and the
browser, e2e and framework CI jobs are this repository's own.

Also:

- **Add a changeset** whenever you change a file a published package ships: `pnpm exec changeset`.
  It will ask which packages changed; name exactly one per changeset file. "Ships" means what ends
  up in the npm tarball: the source compiled into `dist`, `package.json`, the package `README.md`
  and `LICENSE`, and everything else in its `files` (`llms.txt`, `assets/logo.svg`). A README or
  `llms.txt` fix is a release too. Tests, e2e specs, demos and anything outside a published package
  need none. A PR that ships nothing new despite touching those files (a dependency bump, say) can
  carry the `skip-changeset` label instead. The CI gate is `pnpm check:changeset`
  (`rxova-repo-config check-changeset` with `changeset.scope: "shipped"`).
- **If you changed behaviour, change the prose in the same PR.** Grep the package README and the
  docs for the prop you touched. A fix that ships with docs still teaching the old behaviour ships
  invisible.
- **Run both gates before handoff.** `pnpm verify` is the local pre-push/release gate; whole-page
  Playwright suites are intentionally separate, so follow it with `pnpm e2e`.

## Rules

- **Zero runtime dependencies.** `react` stays the only peer dependency (plus `react-dom` where a
  package needs it). A PR adding a runtime dependency needs a very good argument.
- **No stylesheet to import.** Only layout-critical CSS is inlined; everything visual is a CSS
  custom property or a `data-*` hook.
- **Accessibility is not optional.** Each component leans on real platform semantics (a
  `radiogroup` of real radios, real `<input>`s) so the browser provides keyboard, focus, and form
  behaviour. Reimplementing one of those in JavaScript is a signal the markup is wrong.
- The `data-*` attributes in each README are **public API** and covered by semver.
- **Namespace the styling hooks.** A component's custom properties and structural attributes are
  `--rx-<slug>-*` and `data-rx-<slug>-*`, where `<slug>` is the `rxova.slug` in its own
  package.json. State hooks that mean the same thing everywhere — `data-invalid`, `data-disabled`,
  `data-readonly`, `data-focused` — stay unprefixed, so one selector reaches every input in the
  suite. `pnpm check:tokens` enforces it; before it existed the suite drifted into `--rpi-` for
  password and `--rphi-` for phone, one character apart on two fields that share a sign-up form.
- Conventional Commits, enforced by `commitlint` locally and on PRs.

## Release

Automated with Changesets. **Releases run in CI, not locally.**

1. Merge to `main`.
2. The Release workflow opens or updates a version PR with the bumps and changelogs.
3. Merging that PR runs the gate, then publishes changed packages to npm with provenance via OIDC
   trusted publishing — there is no npm token in the repo.

Adding a changeset is the only step you do by hand:

```bash
pnpm exec changeset            # pick the packages + bump, describe the user-visible change
```

`pnpm exec changeset version` is deliberately **not** part of the local workflow: the changelog is
generated by `@changesets/changelog-github`, which needs a `GITHUB_TOKEN` to resolve commits and
contributors. CI supplies it. To preview a bump locally, export a personal access token first.

### Writing a changeset

One changeset per release-worthy change, written for someone reading the changelog — not the diff.
Before a release, re-read the pending files together: they land in a single changelog entry per
package, so a later change that supersedes an earlier one should edit that earlier file rather
than add a contradicting entry.
