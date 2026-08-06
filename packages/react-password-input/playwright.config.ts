import { defineConfig, devices } from '@playwright/test'

/**
 * E2E runs against this package's own `demo/` — built and previewed on its own
 * port, with no dependency on any shared/global playground. The demo aliases the
 * library to source, so the specs exercise the same component the browser suite
 * does, composed into a full page.
 *
 * All three engines, not just Chromium: the two platform APIs this component
 * leans on — `KeyboardEvent.getModifierState('CapsLock')` and swapping a live
 * input's `type` without losing the selection — are exactly the kind that
 * diverge between Blink, Gecko and WebKit.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: 'http://localhost:4177',
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
    url: 'http://localhost:4177/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
