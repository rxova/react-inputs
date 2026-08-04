import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { playwright } from '@vitest/browser-playwright'

export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      {
        // Pure logic. No DOM needed, so no browser cost — this is the project
        // the pre-push hook runs.
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/__tests__/**/*.test.ts', 'src/**/__tests__/**/*.test.tsx'],
          // Browser specs are the other project's job.
          exclude: ['src/**/__tests__/**/*.browser.test.tsx'],
        },
      },
      {
        // Everything about this component is geometry, clipping, hover and
        // focus. jsdom has no layout engine, so a jsdom assertion about a
        // partial fill would be asserting a string, not a rendering.
        extends: true,
        test: {
          name: 'browser',
          include: ['src/**/__tests__/**/*.browser.test.tsx'],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html', 'json-summary', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      // index.ts is a re-export barrel and types.ts is types only; neither has
      // executable lines worth a threshold.
      exclude: ['src/**/__tests__/**', 'src/index.ts', 'src/types.ts'],
      thresholds: {
        // perFile, so one thinly covered module cannot hide behind a
        // well-covered one in the aggregate.
        perFile: true,
        statements: 95,
        branches: 95,
        functions: 95,
        lines: 95,
      },
    },
  },
})
