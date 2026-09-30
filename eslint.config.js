import { defineConfig, globalIgnores } from 'eslint/config'
import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import astro from 'eslint-plugin-astro'

export default defineConfig(
  globalIgnores([
    '**/dist/',
    'coverage/',
    '**/node_modules/',
    // Local AI-assistant state, matching the .gitignore block. ESLint does not
    // read .gitignore, so this has to be repeated here. It matters because
    // `.claude/worktrees/` can hold whole checkouts of this repo: without this
    // rule ESLint lints a second copy of the tree against the root tsconfig,
    // which floods the run with unresolved-type errors and makes `pnpm verify`
    // fail for reasons that have nothing to do with the working tree.
    '**/.claude/',
    // The Astro/Starlight docs site owns its own toolchain: `astro check` is its
    // typecheck (wired in as its `typecheck` task), and its TS/MDX sources sit
    // outside this program's tsconfig, so strictTypeChecked cannot see them.
    // Listed by extension rather than as `apps/docs/**` so that `.astro` is
    // never in the ignore set: those components are hand-written source and
    // were going completely unlinted. A `!` negation does not work here —
    // ESLint prunes an ignored directory before it ever considers the files
    // inside it, so the re-include never fires.
    'apps/docs/**/*.{ts,tsx,js,jsx,mjs,cjs,mdx,md,json}',
    '**/build/',
    '**/.astro/',
    'test-results/',
    'playwright-report/',
    '.pw-browsers/',
    'pw-browsers/',
    '**/__screenshots__/',
    // Build/tool config lives outside the type-checked program in a monorepo;
    // linting it with projectService would demand a tsconfig per nested config.
    '**/*.config.ts',
    '**/*.config.js',
  ]),
  js.configs.recommended,
  // Deliberately the non-type-checked recommended set: the docs site's .astro
  // files are not part of the root tsconfig program, so the type-aware rules
  // have nothing to resolve against. `astro check` covers their types.
  ...astro.configs.recommended,
  {
    // `astro.configs.recommended` leaves `tsconfigRootDir` unset, so the parser
    // infers it by scanning for candidate tsconfigs — and errors out when it
    // finds more than one. A checkout under `.claude/worktrees/` is enough to
    // trigger that, and ignoring the path does not help: the inference runs
    // before the ignore list applies. Pinning the root, exactly as the block
    // below does for .ts/.tsx, makes the parse independent of whatever else
    // happens to be sitting in the working directory.
    files: ['**/*.astro'],
    languageOptions: {
      parserOptions: { tsconfigRootDir: import.meta.dirname },
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    extends: [tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      // A zero-dependency library ships no console noise.
      'no-console': 'error',
    },
  },
  {
    files: [
      'packages/*/src/**/*.{ts,tsx}',
      'packages/*/demo/**/*.{ts,tsx}',
      'apps/playground/**/*.{ts,tsx}',
      'apps/storybook/**/*.{ts,tsx}',
    ],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    // The repository scripts under scripts/. The .ts files are covered by the
    // root tsconfig.json.
    //
    // These are CLIs: reporting to stdout/stderr is their entire output
    // contract, so the library-wide `no-console: error` does not apply.
    files: ['scripts/**/*.{mjs,ts}'],
    languageOptions: { globals: globals.node, sourceType: 'module' },
    rules: { 'no-console': 'off' },
  },
  {
    // The codemod runs under jscodeshift and pokes at untyped AST nodes; the
    // ast-types typings are imprecise, so the type-aware "unnecessary" checks and
    // non-null guards are unreliable here. bin.ts is a CLI, so it needs console.
    files: ['packages/codemod/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      'no-console': 'off',
    },
  },
  {
    files: [
      '**/__tests__/**',
      '**/e2e/**',
      'apps/playground/**',
      'packages/*/demo/**',
      'packages/demo-kit/**',
    ],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      // Browser-test idioms: `await locator.focus()` / `el.click()` return void,
      // and harness helpers legitimately assert on values typed loosely.
      '@typescript-eslint/await-thenable': 'off',
      '@typescript-eslint/no-confusing-void-expression': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
      '@typescript-eslint/no-redundant-type-constituents': 'off',
      '@typescript-eslint/require-await': 'off',
      'no-console': 'off',
    },
  },
)
