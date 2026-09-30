import react from '@vitejs/plugin-react'
import { playwright } from '@vitest/browser-playwright'
import { baseVitestConfig } from '@rxova/repo-config/vitest'

/**
 * The shared preset: a `unit` project and a `browser` project over one config,
 * and v8 coverage over every file under src/ with a per-file threshold (95 on
 * every axis unless named below), so one thinly covered module cannot hide
 * behind a well-covered one in the aggregate.
 */
export default baseVitestConfig({
  root: import.meta.dirname,
  plugins: [react()],
  // Pure logic. No DOM needed, so no browser cost — this is the project
  // the pre-push hook runs.
  include: ['src/**/__tests__/**/*.test.ts', 'src/**/__tests__/**/*.test.tsx'],
  browser: {
    // Drag-and-drop, `DataTransfer`, object URLs and the file picker are
    // browser APIs jsdom stubs rather than implements — and the URL leak
    // this component exists to avoid is only observable in a real one.
    include: ['src/**/__tests__/**/*.browser.test.tsx'],
    instances: [{ browser: 'chromium' }],
    provider: playwright(),
  },
  // Test helpers under __tests__ and types.ts (types only) have no executable
  // lines worth a threshold; the preset already leaves out src/index.ts.
  exclude: ['src/**/__tests__/**', 'src/types.ts'],
  reporter: ['text', 'text-summary', 'html', 'json-summary', 'lcov'],
})
