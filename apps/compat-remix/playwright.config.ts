import { basePlaywrightConfig } from '@rxova/repo-config/playwright'

export default basePlaywrightConfig({
  command: 'pnpm run start',
  port: 4303,
  // As these ran before the preset: no CI retries, no forbidOnly, the list
  // reporter.
  retries: 0,
  forbidOnly: false,
  reporter: [['list']],
})
