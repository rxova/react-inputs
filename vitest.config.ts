import { baseVitestConfig } from '@rxova/repo-config/vitest'

/**
 * The repository's own scripts under scripts/: the component registry, the
 * token-namespace and Playwright browser-list checks, and the meta-package
 * test. No coverage gate: the component packages hold the 95% per-file line,
 * which is meaningless for scripts that read the filesystem.
 */
export default baseVitestConfig({
  root: import.meta.dirname,
  include: ['scripts/**/*.test.ts'],
  coverage: false,
  // Some cases build a scratch repository on disk, which is slower than the 5s
  // default on a cold runner.
  testTimeout: 30_000,
})
