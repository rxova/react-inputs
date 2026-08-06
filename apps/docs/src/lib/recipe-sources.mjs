/** The six design-system recipes shown for every discovered component. */
export const recipeLibraries = [
  { id: 'shadcn', label: 'shadcn/ui', href: 'https://ui.shadcn.com/docs' },
  {
    id: 'radix',
    label: 'Radix Themes',
    href: 'https://www.radix-ui.com/themes/docs/overview/getting-started',
  },
  { id: 'mui', label: 'Material UI', href: 'https://mui.com/material-ui/getting-started/' },
  { id: 'chakra', label: 'Chakra UI', href: 'https://chakra-ui.com/docs/get-started/installation' },
  { id: 'mantine', label: 'Mantine', href: 'https://mantine.dev/getting-started/' },
  { id: 'ant', label: 'Ant Design', href: 'https://ant.design/docs/react/introduce' },
]

const imported = import.meta.glob('../recipes/*/*.tsx', {
  eager: true,
  query: '?raw',
  import: 'default',
})

export const recipeSources = new Map(
  Object.entries(imported).map(([path, source]) => {
    const match = /\/recipes\/([^/]+)\/([^/]+)\.tsx$/.exec(path)
    if (!match || typeof source !== 'string') throw new Error(`invalid integration recipe ${path}`)
    return [`${match[1]}/${match[2]}`, source.trim()]
  }),
)

export function recipesFor(slug, sources = recipeSources) {
  return recipeLibraries.map((library) => {
    const source = sources.get(`${library.id}/${slug}`)
    if (source === undefined) throw new Error(`${slug}: missing ${library.label} recipe`)
    return { ...library, source }
  })
}

export function checkRecipeCoverage(components, sources = recipeSources) {
  const expected = new Set(
    components.flatMap(({ slug }) => recipeLibraries.map(({ id }) => `${id}/${slug}`)),
  )
  const missing = [...expected].filter((key) => !sources.has(key))
  const orphans = [...sources.keys()].filter((key) => !expected.has(key))
  return { expected: expected.size, missing, orphans }
}
