import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  // Dual ESM + CJS. A password field is the kind of thing that gets retrofitted
  // into an old auth screen, and those are disproportionately still CJS/Jest.
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  treeshake: true,
  // Rolldown preserves the `use client` directive already present in
  // src/index.ts, so adding an output banner here would emit it twice.
  deps: { neverBundle: ['react', 'react/jsx-runtime'] },
})
