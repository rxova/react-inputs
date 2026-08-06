import process from 'node:process'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { checkManualA11y } from './manual-a11y'

export const formatManualA11yFailures = (failures: ReturnType<typeof checkManualA11y>): string =>
  `Manual accessibility evidence is incomplete:\n${failures
    .map(({ component, reason }) => `  ✗ ${component}: ${reason}`)
    .join('\n')}`

const isEntrypoint =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href

if (isEntrypoint) {
  const failures = checkManualA11y(resolve(process.argv[2] ?? process.cwd()))
  if (failures.length > 0) {
    console.error(formatManualA11yFailures(failures))
    process.exit(1)
  }
  console.log('✔ every component has current passing VoiceOver/NVDA evidence')
}
