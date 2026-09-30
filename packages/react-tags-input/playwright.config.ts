import { basePlaywrightConfig } from "@rxova/repo-config/playwright";

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
export default basePlaywrightConfig({
  command: "pnpm run demo:preview",
  port: 4182,
  browsers: ["chromium", "firefox", "webkit"],
  // The specs in a file are independent, so they may run in any order — but on
  // one worker (the preset's default), so the three packages Turbo runs at
  // once stay bounded.
  fullyParallel: true,
  trace: "on-first-retry",
  // An HTML report on CI, uploaded as an artifact when the job fails.
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
});
