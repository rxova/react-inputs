import { defineConfig } from 'tsdown'
import { reactBuildConfig } from '@rxova/repo-config/tsdown'

// Dual ESM + CJS. A password field is the kind of thing that gets retrofitted
// into an old auth screen, and those are disproportionately still CJS/Jest.
//
// The shared React preset: dual `.mjs`/`.cjs` with `.d.mts`/`.d.cts`, React
// never bundled, and @rxova/ts-utils the only dependency that may be inlined, so
// the package keeps its zero-runtime-dependency promise. Rolldown preserves the
// `use client` directive already present in src/index.ts, so no banner is added
// (it would be emitted twice).
export default defineConfig(reactBuildConfig({ entry: { index: 'src/index.ts' } }))
