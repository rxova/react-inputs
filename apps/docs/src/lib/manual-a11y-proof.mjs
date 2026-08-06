const imported = import.meta.glob('../../../../accessibility/manual/*.json', {
  eager: true,
  import: 'default',
})

export const manualA11yRecords = Object.entries(imported)
  .map(([path, record]) => {
    if (typeof record !== 'object' || record === null || !('component' in record)) {
      throw new Error(`invalid manual accessibility record ${path}`)
    }
    return record
  })
  .sort((a, b) => String(a.component).localeCompare(String(b.component)))

const resultFor = (record, combination) =>
  record.results?.find((result) => result.combination === combination)

const shown = (result) =>
  result?.status === 'pass'
    ? `Pass — ${result.testedAt}, ${result.tester}; ${result.osVersion}; ${result.browserVersion}; ${result.assistiveTechnologyVersion}`
    : 'Pending human test'

export function manualA11yMarkdown(records = manualA11yRecords) {
  const lines = [
    '| Component | VoiceOver + Safari | NVDA + Chrome | NVDA + Firefox |',
    '| --- | --- | --- | --- |',
  ]
  for (const record of records) {
    lines.push(
      `| ${record.component} | ${shown(resultFor(record, 'voiceover-safari'))} | ${shown(resultFor(record, 'nvda-chrome'))} | ${shown(resultFor(record, 'nvda-firefox'))} |`,
    )
  }
  return lines.join('\n')
}
