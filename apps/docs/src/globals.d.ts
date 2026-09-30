// Build-time constants substituted by Vite.

import type { ComponentRef } from './lib/site-markdown.d.mts'

declare global {
  /**
   * The component list, injected by `vite.define` in astro.config.mjs from
   * `componentPackages()`.
   *
   * The endpoints in src/pages cannot call `componentPackages()` themselves: it
   * resolves the repo root from its own `import.meta.url`, and they are bundled
   * into a prerender chunk under `dist/`, where that points at a directory which
   * does not exist. See the note on the `define` block.
   */
  const __RXOVA_COMPONENTS__: ComponentRef[]
}

export {}
