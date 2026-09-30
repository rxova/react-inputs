import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { baseVitestConfig } from "@rxova/repo-config/vitest";

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
  include: ["src/**/__tests__/**/*.test.ts", "src/**/__tests__/**/*.test.tsx"],
  browser: {
    // Segment focus, arrow stepping and the focus ring are all real browser
    // behaviour. jsdom has no layout engine and only a sketch of focus, so
    // an assertion there would be asserting our own mock back at us.
    include: ["src/**/__tests__/**/*.browser.test.tsx"],
    instances: [{ browser: "chromium" }],
    provider: playwright(),
  },
  // Test helpers under __tests__ and types.ts (types only) have no executable
  // lines worth a threshold; the preset already leaves out src/index.ts.
  exclude: ["src/**/__tests__/**", "src/types.ts"],
  reporter: ["text", "text-summary", "html", "json-summary", "lcov"],
});
