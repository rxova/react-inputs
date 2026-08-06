import { defineConfig, devices } from '@playwright/test'

/**
 * E2E runs against this package's own `demo/` — built and previewed on its own
 * port, with no dependency on any shared/global playground. The demo aliases the
 * library to source, so the specs exercise the same component the browser suite
 * does, composed into a full page.
 *
 * All three engines, not just Chromium. This component's whole segment order is
 * decided by `Intl.DateTimeFormat().formatToParts`, and the three engines ship
 * three different ICU builds — so "does `en-GB` really put the day first here"
 * is a question only a real run in each engine can answer.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: 'http://localhost:4181',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'pnpm run demo:preview',
    url: 'http://localhost:4181/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
