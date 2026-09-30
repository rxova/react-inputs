import { defineConfig } from 'vitest/config'

/**
 * Covers the workshop's configuration, not its stories — the stories render the
 * same components the packages already test to 95% per file, and re-asserting
 * that here would be duplication. What is unique to this app is the docs
 * pipeline: an extractor pointed at sources in another directory, which fails
 * silently when it stops matching them.
 *
 * `test` and `test:coverage` are the same command, as in apps/docs and
 * the root scripts: the component packages distinguish them (the latter adds the
 * per-file thresholds, meaningless for a config check), and both the push gate
 * and CI fan out on the task *name* — declaring both is what puts this in
 * `pnpm run test:coverage`, the job CI actually runs.
 *
 * `test.root` is deliberately left at this directory. The docgen plugin builds
 * its include filter with vite's `createFilter` and passes no `resolve`, so a
 * relative glob would be anchored to `process.cwd()`; running from here is what
 * `storybook dev` does, and the test has to see the same resolution it does.
 */
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // A real Vite server plus a TypeScript program over every package source:
    // slow to start, and slower still on a cold CI runner.
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
})
