import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { playwright } from '@vitest/browser-playwright'

export default defineConfig({
  plugins: [react()],
  resolve: {
    // @rxova/ts-utils/react is a root devDependency, so pnpm links its `react`
    // peer to the root's copy. `test:react-min` swaps only this package's React
    // to 18, which would leave the hook calling into a second React. Dedupe makes
    // every import resolve from this package, so the whole test sees one React.
    dedupe: ['react', 'react-dom'],
  },
  test: {
    projects: [
      {
        // Pure logic: sanitize, paste distribution, caret<->index mapping. No
        // DOM needed, so no browser cost — this is the project the pre-push
        // hook runs.
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
        // Everything spatial about this component is caret geometry, click->slot
        // mapping, selection and focus. jsdom has no layout engine, so a jsdom
        // assertion about which slot a click lands on would assert a string,
        // not a rendering.
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
        // Branches at 90: the single-input + spatial-layout design carries
        // genuinely-defensive DOM/SSR guards (a null `parentElement`, iOS
        // force-detection that a headless browser is never subject to, the
        // once-per-document nonce injection). Those branch arms can't be
        // exercised without contriving impossible states; the executable
        // logic still holds the 95% line on statements, functions and lines.
        branches: 90,
        functions: 95,
        lines: 95,
      },
    },
  },
})
