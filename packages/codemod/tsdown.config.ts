import { readdirSync } from 'node:fs'
import { defineConfig } from 'tsdown'
import { baseBuildConfig } from '@rxova/repo-config/tsdown'

// The transforms and their CLI run under the jscodeshift Runner in Node, so
// build CJS — the format jscodeshift loads most reliably across consumer setups.
// Each transform is its own entry (read from src/transforms/, so a new file there
// is picked up automatically) and emits to dist/transforms/<name>.cjs, which the
// dispatcher in bin.ts resolves by name. Entries are an object, as the shared
// preset asks, so the output names never depend on an inferred base directory.
const transforms = readdirSync(new URL('./src/transforms/', import.meta.url))
  .filter((file) => file.endsWith('.ts'))
  .map((file) => file.replace(/\.ts$/, ''))

export default defineConfig(
  baseBuildConfig({
    entry: {
      bin: 'src/bin.ts',
      ...Object.fromEntries(
        transforms.map((name) => [`transforms/${name}`, `src/transforms/${name}.ts`]),
      ),
    },
    format: ['cjs'],
    // The package's own engines floor, which is what tsdown targeted before the
    // preset's `node22`.
    target: 'node20.19',
  }),
)
