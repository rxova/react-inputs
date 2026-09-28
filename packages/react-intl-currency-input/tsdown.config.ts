import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  // Dual ESM + CJS. ESM-only would lock out the CJS/Jest long tail
  // that a drop-in form input lives in.
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  treeshake: true,
  // Rolldown preserves the `use client` directive already present in
  // src/index.ts, so adding an output banner here would emit it twice.
  deps: {
    neverBundle: ['react', 'react/jsx-runtime'],
    // @rxova/ts-utils is a root devDependency inlined into dist, so the package
    // keeps its zero-runtime-dependency promise. Listing it here turns any other
    // dependency that slips into the bundle into a build error.
    onlyBundle: ['@rxova/ts-utils'],
  },
})
