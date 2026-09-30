import { basePlaywrightConfig } from "@rxova/repo-config/playwright";

export default basePlaywrightConfig({
  command: "pnpm run preview",
  port: 4301,
  // As these ran before the preset: no CI retries, no forbidOnly, the list
  // reporter.
  retries: 0,
  forbidOnly: false,
  reporter: [["list"]],
});
