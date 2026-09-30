import { basePlaywrightConfig } from "@rxova/repo-config/playwright";

/**
 * E2E runs against this package's own `demo/` — built and previewed on its own
 * port, with no dependency on any shared/global playground. The demo aliases the
 * library to source, so the specs exercise the same component the browser suite
 * does, composed into a full page.
 *
 * All three engines, not just Chromium. File selection is the part of the
 * platform the engines agree on least: `DataTransfer` construction, what a
 * synthesised drop carries, whether a hidden `<input type="file">` opens its
 * picker from `.click()`, and — in WebKit — whether the drop zone button is in
 * the tab order at all. None of that is answerable outside a real engine.
 */
export default basePlaywrightConfig({
  command: "pnpm run demo:preview",
  port: 4183,
  browsers: ["chromium", "firefox", "webkit"],
  // The specs in a file are independent, so they may run in any order — but on
  // one worker (the preset's default), so the three packages Turbo runs at
  // once stay bounded.
  fullyParallel: true,
  trace: "on-first-retry",
  // An HTML report on CI, uploaded as an artifact when the job fails.
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
});
