// Registry contents are discovered from the same component manifests that
// drive the sidebar and CI matrices. A component contributes one
// `<slug>-field.tsx` and one `<slug>-field.css`; missing or orphaned files throw
// during the docs build instead of silently shrinking the public registry.

import { registryItem } from './registry.mjs'

const imported = import.meta.glob('../registry/*-field.{tsx,css}', {
  eager: true,
  query: '?raw',
  import: 'default',
})

export const registrySources = new Map(
  Object.entries(imported).map(([path, source]) => {
    const name = path.split('/').at(-1)
    if (!name || typeof source !== 'string') throw new Error(`invalid registry source ${path}`)
    return [name, source]
  }),
)

export function registryItems(components, sources = registrySources) {
  const expected = new Set()
  const items = components.map(({ slug, label, name, description }) => {
    const itemName = `${slug}-field`
    const tsxName = `${itemName}.tsx`
    const cssName = `${itemName}.css`
    expected.add(tsxName)
    expected.add(cssName)

    const tsx = sources.get(tsxName)
    const css = sources.get(cssName)
    if (tsx === undefined || css === undefined) {
      const missing = [tsx === undefined && tsxName, css === undefined && cssName].filter(Boolean)
      throw new Error(`${itemName}: missing registry source ${missing.join(', ')}`)
    }

    return registryItem({
      name: itemName,
      title: `${label} field`,
      description,
      dependency: name,
      tsx,
      css,
    })
  })

  const orphans = [...sources.keys()].filter((name) => !expected.has(name))
  if (orphans.length > 0) throw new Error(`orphaned registry source: ${orphans.join(', ')}`)

  return items
}
