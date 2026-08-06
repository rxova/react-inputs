const imported = import.meta.glob('../../../../apps/compat-*/package.json', {
  eager: true,
  import: 'default',
})

const frameworks = [
  {
    packageName: '@rxova/compat-vite',
    label: 'Vite',
    dependency: 'vite',
    rendering: 'Client-rendered SPA',
  },
  {
    packageName: '@rxova/compat-next',
    label: 'Next.js',
    dependency: 'next',
    rendering: 'App Router SSR + hydration',
  },
  {
    packageName: '@rxova/compat-remix',
    label: 'Remix lineage (React Router)',
    dependency: 'react-router',
    rendering: 'SSR + hydration',
  },
]

export function frameworkCompatibilityRows(manifests = imported) {
  const byName = new Map(Object.values(manifests).map((manifest) => [manifest.name, manifest]))

  return frameworks.map((framework) => {
    const manifest = byName.get(framework.packageName)
    if (!manifest) throw new Error(`missing compatibility fixture ${framework.packageName}`)

    const version =
      manifest.dependencies?.[framework.dependency] ??
      manifest.devDependencies?.[framework.dependency]
    if (!version) {
      throw new Error(`${framework.packageName} does not declare ${framework.dependency}`)
    }

    return {
      ...framework,
      version,
      coverage: 'Production build, hydration, nine interactions, axe, console errors',
    }
  })
}

export const frameworkCompatibility = frameworkCompatibilityRows()

export function frameworkCompatibilityMarkdown(rows = frameworkCompatibility) {
  return [
    '| Framework | Tested dependency range | Rendering path | Browser proof |',
    '| --- | --- | --- | --- |',
    ...rows.map(
      ({ label, version, rendering, coverage }) =>
        `| ${label} | \`${version}\` | ${rendering} | ${coverage} |`,
    ),
  ].join('\n')
}
