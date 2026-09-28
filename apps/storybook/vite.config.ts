import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { existsSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Loaded by Storybook's Vite builder (it picks up the project vite.config
// automatically). Same convention as the playground: every workspace package is
// aliased to its *source*, so the workshop runs — dev and build — without a
// prior library build, and prop tables are extracted from the annotated source
// rather than from bundled output.
const src = (rel: string) => fileURLToPath(new URL(rel, import.meta.url))

// `@rxova/<name>` for each `packages/<name>` in this workspace, read from disk
// so an input added later is covered without an edit here. Only those: the
// shared `@rxova/ts-utils` that packages bundle in is a real dependency from
// npm, with no `packages/ts-utils` to alias it to.
const workspacePackage = new RegExp(
  `^@rxova/(${readdirSync(src('../../packages'))
    .filter((dir) => existsSync(src(`../../packages/${dir}/src/index.ts`)))
    .join('|')})$`,
)

export default defineConfig({
  plugins: [react()],
  resolve: {
    // One rule covers every workspace package and any added later (see
    // `workspacePackage`). No subpath entries are needed here — the stories
    // ship their own stylesheet instead of demo-kit's page chrome.
    alias: [
      {
        find: workspacePackage,
        replacement: src('../../packages/$1/src/index.ts'),
      },
    ],
  },
})
