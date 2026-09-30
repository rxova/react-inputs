import tseslint from "typescript-eslint";
import { rxova } from "@rxova/repo-config/eslint";

export default rxova(
  {
    tsconfigRootDir: import.meta.dirname,
    // strictTypeChecked plus stylisticTypeChecked, the bar this repository has
    // always linted at, on top of the shared base.
    strict: true,
    extends: [tseslint.configs.stylisticTypeChecked],
    // The docs site's hand-written .astro components. `astro check` is their
    // typecheck (the docs `typecheck` task).
    astro: true,
    // eslint-plugin-react, react-hooks and jsx-a11y on everything that renders:
    // the components, their demos, the playground and the Storybook workshop.
    react: {
      files: [
        "packages/*/src/**/*.{ts,tsx}",
        "packages/*/demo/**/*.{ts,tsx}",
        "packages/demo-kit/**/*.{ts,tsx}",
        "apps/playground/**/*.{ts,tsx}",
        "apps/storybook/**/*.{ts,tsx}",
        "apps/compat-*/**/*.{ts,tsx}",
      ],
    },
    // Test relaxations on the unit and browser suites, the e2e specs, and the
    // demo pages those specs drive.
    tests: {
      files: [
        "**/__tests__/**",
        "**/e2e/**",
        "**/*.{test,spec}.{ts,tsx,mjs}",
        "apps/playground/**",
        "packages/*/demo/**",
        "packages/demo-kit/**",
      ],
    },
    // The repository scripts are Node CLIs.
    node: ["scripts/**"],
    // CLIs: reporting to stdout/stderr is their entire output contract, so the
    // library-wide `no-console` does not apply. The codemod's bin is one too.
    consoleAllowed: ["scripts/**", "packages/codemod/**"],
    ignores: [
      // The Astro/Starlight docs site owns its own toolchain: `astro check` is its
      // typecheck (wired in as its `typecheck` task), and its TS/MDX sources sit
      // outside this program's tsconfig. Listed by extension rather than as
      // `apps/docs/**` so that `.astro` is never in the ignore set: those
      // components are hand-written source. A `!` negation does not work here —
      // ESLint prunes an ignored directory before it ever considers the files
      // inside it.
      "apps/docs/**/*.{ts,tsx,js,jsx,mjs,cjs,mdx,md,json}",
      ".pw-browsers/",
      "pw-browsers/",
      "**/__screenshots__/",
    ],
    rules: {
      // `autoFocus` passed to a component is that component's to handle — each
      // input here takes it as an opt-in prop, exactly as a native input does.
      // Only a DOM element given one is flagged.
      "jsx-a11y/no-autofocus": ["error", { ignoreNonDOM: true }],
    },
  },
  {
    // The codemod runs under jscodeshift and pokes at untyped AST nodes; the
    // ast-types typings are imprecise, so the type-aware "unnecessary" checks
    // and non-null guards are unreliable here.
    files: ["packages/codemod/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-unnecessary-condition": "off",
    },
  },
);
