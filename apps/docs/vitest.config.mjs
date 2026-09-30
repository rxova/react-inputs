import { defineConfig } from 'vitest/config'

/**
 * Covers the build scripts, and the one src module that is not verified by the
 * build: src/lib/proof.mjs, which feeds the landing page's claims by reading the
 * configs CI enforces. The rest of the site is verified by the build itself —
 * `astro check`, starlight-links-validator and the link checker all run there —
 * so there is still no component suite here to configure.
 *
 * `test` and `test:coverage` are the same command, as in the root scripts: the
 * component packages distinguish them (the latter adds the 95% per-file
 * thresholds, which do not apply to a script that reads the filesystem), and
 * both the push gate and CI fan out on the task *name*. Declaring both is what
 * puts these tests in `pnpm run test:coverage`, which is the job CI actually
 * runs.
 */
export default defineConfig({
  test: {
    include: ['scripts/**/*.test.mjs', 'src/**/*.test.mjs'],
    environment: 'node',
    // The CLI cases spawn a real process, which is slower than the 5s default
    // on a cold runner.
    testTimeout: 30_000,
  },
})
