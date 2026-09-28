import { join } from 'node:path'

import { publishedDirs } from '@rxova/repo-config'

import { isShippedPath } from './is-shipped-path'
import { readManifest } from './manifest'

/**
 * The paths in `changed` (relative to the repository root) that a published
 * package ships. A package is published when its manifest under `packages/` is
 * not private, the same signal npm and changesets use. A package with no
 * manifest at `root` — deleted in this range, say — ships nothing any more.
 */
export const shippedChanges = (changed: readonly string[], root: string): string[] => {
  const manifests = new Map(
    publishedDirs(root).map((dir) => [
      dir,
      readManifest(join(root, 'packages', dir, 'package.json')),
    ]),
  )

  return changed.filter((file) => {
    const [top, dir, ...rest] = file.split('/')
    if (top !== 'packages' || dir === undefined || rest.length === 0) return false
    const manifest = manifests.get(dir)
    return manifest !== undefined && isShippedPath(rest.join('/'), manifest)
  })
}
