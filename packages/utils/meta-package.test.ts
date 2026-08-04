import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { componentPackages, REPO_ROOT } from './component-packages.mjs'
import { readManifest } from './manifest.js'

/**
 * `@rxova/react-inputs` is the "whole suite from one install" package. Its
 * dependency list and its re-exports cannot be discovered at runtime — npm
 * needs the dependency declared, and a static `export *` is what makes the
 * types and tree-shaking work — so they are the two lists that must be written
 * by hand and therefore the two that go stale.
 *
 * Both fail quietly. A component missing from `dependencies` still builds
 * locally, because pnpm hoists it in the workspace; it breaks only for someone
 * installing from npm. A component missing from index.ts imports fine from its
 * own package and is simply absent from the meta-package. Neither shows up in a
 * build, a type-check or any component's own suite.
 *
 * The re-export check counts a named `export { … } from` alongside `export *`:
 * four packages must be re-exported by name because their pure helpers collide
 * across the merged namespace (`toISO` in date and time, `attempt` in tags and
 * file). What matters is that every component package is reachable from here,
 * not which of the two forms carried it.
 */

const metaDir = join(REPO_ROOT, 'packages/react-inputs')
const components = componentPackages()

describe('@rxova/react-inputs', () => {
  it('depends on every component package', () => {
    const manifest = readManifest(join(metaDir, 'package.json'))
    const dependencies = Object.keys(manifest.dependencies ?? {})

    expect(dependencies.sort()).toEqual(components.map((pkg) => pkg.name).sort())
  })

  it('re-exports every component package', () => {
    const source = readFileSync(join(metaDir, 'src/index.ts'), 'utf8')
    const reExported = new Set(
      [...source.matchAll(/export (?:\*|\{[^}]*\}) from '([^']+)'/g)]
        .map(([, name]) => name)
        .filter((name) => name !== undefined),
    )

    expect([...reExported].sort()).toEqual(components.map((pkg) => pkg.name).sort())
  })
})
