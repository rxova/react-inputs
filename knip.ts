import type { KnipConfig } from 'knip'

/**
 * Unused files, exports and dependencies, as a gate rather than a report.
 *
 * The `export` keyword is the point: an export nothing imports still has to be
 * kept working, still shows up in editor completions, and still reads as part
 * of the contract. Nothing else in this repository notices one.
 *
 * Entry points are inferred from each package's manifest, so what follows is
 * only what inference cannot know — every entry a place where a file is reached
 * by something other than a TypeScript import.
 */
export default {
  // Advice nobody has to act on is advice that stops being read.
  treatConfigHintsAsErrors: true,
  // ci.yml runs `./node_modules/.bin/vitest` from inside each component package,
  // on the Node under test rather than the toolchain's. Knip reads the
  // invocation and looks for a root-level `vitest`, which deliberately is not
  // there: every package that runs tests declares its own.
  ignoreBinaries: ['vitest'],
  workspaces: {
    'apps/docs': {
      entry: [
        // Six design-system recipes per component, loaded by
        // `import.meta.glob('../recipes/*/*.tsx', { query: '?raw' })` in
        // src/lib/recipe-sources.mjs and rendered as source text, never called.
        // They are entry points precisely because nothing imports their
        // bindings — the file *is* the published artefact, and it stays a real
        // .tsx so the typecheck keeps it honest.
        'src/recipes/*/*.tsx',
        // Named as a string in astro.config.mjs (`routeMiddleware:`), which
        // knip reads as config rather than as an import.
        'src/route-middleware.mjs',
      ],
      ignore: [
        // Two one-shot Docusaurus-to-Starlight migrations, deliberately kept:
        // their own headers say they stay so "the transforms it applied are
        // auditable next to the diff they produced". Dead by design, not by
        // accident.
        'scripts/migrate-content.mjs',
        'scripts/restructure-components.mjs',
      ],
    },
    'apps/playground': {
      // The playground discovers its pages rather than listing them:
      // `import.meta.glob('../../packages/*/demo/Demos.tsx')` in App.tsx pulls
      // in every component package's own demo, and those demos import the
      // component under test plus the four form libraries they integrate with.
      // Vite resolves all of it at build time; knip does not follow a glob into
      // another workspace, so from here the dependencies look unreferenced.
      ignoreDependencies: [
        '@rxova/react-date-input',
        '@rxova/react-file-input',
        '@rxova/react-intl-currency-input',
        '@rxova/react-otp-input',
        '@rxova/react-password-input',
        '@rxova/react-phone-input',
        '@rxova/react-rating-input',
        '@rxova/react-tags-input',
        '@rxova/react-time-input',
        '@tanstack/react-form',
        'formik',
        'react-final-form',
        // react-final-form's peer, used through it rather than directly.
        'final-form',
        'react-hook-form',
      ],
    },
    'packages/utils': {
      ignore: [
        // The types for component-packages.mjs. The module stays plain .mjs so
        // an Astro config and a bare `node` call can import it without a build
        // step; TypeScript picks this sibling up by filename, so nothing ever
        // imports it by path.
        'component-packages.d.mts',
      ],
    },
  },
} satisfies KnipConfig
