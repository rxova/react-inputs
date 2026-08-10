import { defineConfig, devices } from '@playwright/test'

/**
 * E2E runs against this package's own `demo/` — built and previewed on its own
 * port, with no dependency on any shared/global playground.
 *
 * All three engines, and here that matters more than anywhere else in the
 * suite. The zone list, the localised names and — critically — *which spelling
 * of a zone the engine reports* all come from that engine's ICU build, and the
 * three ship three different ones. Whether this run sees `Europe/Kiev` or
 * `Europe/Kyiv` is the whole subject of `isSameZone`, so a Chromium-only run
 * would be testing one third of the claim.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: 'http://localhost:4187',
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
    url: 'http://localhost:4187/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
