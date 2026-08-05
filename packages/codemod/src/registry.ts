/**
 * The single source of truth for which transforms `@rxova/codemod` ships.
 *
 * Each `name` must match a file at `src/transforms/<name>.ts` (built to
 * `dist/transforms/<name>.cjs`); the dispatcher in `bin.ts` resolves it by that
 * convention and jscodeshift loads the built file. Add a migration by dropping a
 * transform in `src/transforms/` and listing it here.
 */
export interface CodemodEntry {
  /** CLI name and the transform filename (without extension). */
  name: string
  /** One-liner shown by `--help`. */
  description: string
}

export const TRANSFORMS: CodemodEntry[] = [
  {
    name: 'input-otp-to-otp',
    description: 'Migrate `input-otp` imports and usage to @rxova/react-otp-input.',
  },
  {
    name: 'currency-on-change',
    description:
      'Swap the 1.0 currency handlers: `onValueChange` becomes `onChange`, and any native `onChange` becomes `onNativeChange`.',
  },
  {
    name: 'rx-token-prefixes',
    description:
      'Rename 1.0 styling hooks: --otp-* / --rfs-* and data-otp-* / data-rfs-* to --rx-<name>-*. Stylesheets need the sed line in the migration guide.',
  },
]
