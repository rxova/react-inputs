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
  // @rxova/ts-utils/react is a root devDependency, so pnpm links its `react`
  // peer to the root's copy. The React 18 job pins this package's React to 18,
  // which would leave the hook calling into a second React. Dedupe makes every
  // import resolve from this package, so the whole test sees one React.
  dedupe: ['react', 'react-dom'],
  // The estimator and the rule engine are pure functions over strings —
  // no DOM, no browser cost. This is the project the pre-push hook runs.
  include: ['src/**/__tests__/**/*.test.ts', 'src/**/__tests__/**/*.test.tsx'],
  browser: {
    // Caret preservation across a type swap, `getModifierState('CapsLock')`,
    // and focus retention through the reveal toggle are all things jsdom
    // fakes. Asserting them there would assert our own mock back at us.
    include: ['src/**/__tests__/**/*.browser.test.tsx'],
    instances: [{ browser: 'chromium' }],
    provider: playwright(),
  },
  // Test helpers under __tests__ and types.ts (types only) have no executable
  // lines worth a threshold; the preset already leaves out src/index.ts.
  exclude: ['src/**/__tests__/**', 'src/types.ts'],
  reporter: ['text', 'text-summary', 'html', 'json-summary', 'lcov'],
})
