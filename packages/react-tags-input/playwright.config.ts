import { defineConfig, devices } from '@playwright/test'

/**
 * E2E runs against this package's own `demo/` — built and previewed on its own
 * port, with no dependency on any shared/global playground. The demo aliases the
 * library to source, so the specs exercise the same component the browser suite
 * does, composed into a full page.
 *
 * All three engines, not just Chromium. Two of this component's promises are
 * engine-specific and cannot be checked anywhere else: WebKit leaves buttons out
 * of the tab order unless Full Keyboard Access is on, which is why every remove
 * button carries an explicit `tabindex` — and Firefox ignores `clipboardData`
 * passed to a synthesised `ClipboardEvent`, so the paste-splitting path behaves
 * differently there than the browser suite can show.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: 'http://localhost:4182',
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
    url: 'http://localhost:4182/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
