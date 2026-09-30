import { defineConfig } from 'tsdown'
import { reactBuildConfig } from '@rxova/repo-config/tsdown'

// Dual ESM + CJS. ESM-only would lock out the CJS/Jest long tail a drop-in
// OTP field lives in — many auth flows are still on older toolchains.
//
// The shared React preset: dual `.mjs`/`.cjs` with `.d.mts`/`.d.cts`, React
// never bundled, and @rxova/ts-utils the only dependency that may be inlined, so
// the package keeps its zero-runtime-dependency promise. Rolldown preserves the
// `use client` directive already present in src/index.ts, so no banner is added
// (it would be emitted twice).
export default defineConfig(reactBuildConfig({ entry: { index: 'src/index.ts' } }))
