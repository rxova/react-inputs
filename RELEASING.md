# Releasing

The published packages (all `@rxova/*`, public):

| Package                            | Replaces (old npm name)                                                |
| ---------------------------------- | ---------------------------------------------------------------------- |
| `@rxova/react-intl-currency-input` | — (new name; `react-intl-currency-input` is a third party's, not ours) |
| `@rxova/react-rating-input`        | `react-feedback-stars`                                                 |
| `@rxova/react-otp-input`           | -                                                                      |
| `@rxova/react-password-input`      | -                                                                      |
| `@rxova/react-phone-input`         | -                                                                      |
| `@rxova/react-date-input`          | -                                                                      |
| `@rxova/react-time-input`          | -                                                                      |
| `@rxova/react-tags-input`          | -                                                                      |
| `@rxova/react-file-input`          | -                                                                      |
| `@rxova/react-inputs` (meta)       | —                                                                      |
| `@rxova/codemod`                   | -                                                                      |

`@rxova/utils`, `@rxova/playground`, and `@rxova/docs` are `private` and never publish.

Releases run from CI (`.github/workflows/release.yml`) via Changesets, publishing to npm
with **provenance** through **OIDC trusted publishing** — no long-lived `NPM_TOKEN` in the repo.

## One-time setup

1. **Enable GitHub Actions** on `rxova/react-inputs` (Settings → Actions → General → allow actions).
2. **Configure npm trusted publishing** for each `@rxova/*` package. On npmjs.com, per package
   (Settings → _Trusted Publisher_): provider **GitHub Actions**, repository `rxova/react-inputs`,
   workflow `release.yml`. The `@rxova` org must exist and you must be an owner/publisher on it.
   - If npm will not let you attach a trusted publisher to a name that has never been published,
     bootstrap that package once (see below), then add the trusted publisher and rely on OIDC
     for every release after.

### First-publish bootstrap (only if OIDC can't create the package)

Publish once locally to claim each name, then switch to OIDC:

```bash
npm login                        # as an @rxova owner
pnpm run build
pnpm -r --filter='./packages/*' --filter='!@rxova/utils' exec npm publish --access public
```

## Cutting a release

- Add a changeset per user-facing change (`pnpm exec changeset`) and merge to `main`. The workflow
  opens a "version packages" PR; merging that PR publishes. New packages start at `0.1.0` through
  a `minor` changeset rather than publishing the placeholder `0.0.0` from source.
- Never edit package versions or changelogs by hand. The generated version PR is the review point
  for the exact version set and release notes.
- After Changesets publishes, the release job installs the exact reported versions from npm in a
  fresh project and resolves each React package through ESM and CommonJS. This catches registry
  propagation or a missing publication after the pre-release tarball checks have passed.

## Deprecating the old packages

**After** the `@rxova/*` packages are live, point the old names at them. Run as the owner of the
old package (`npm login`):

```bash
npm deprecate react-feedback-stars "Moved to @rxova/react-rating-input"
```
