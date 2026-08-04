import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// The package's own dev-only demo — the target its Playwright suite builds and
// previews (no shared/global playground). The component is aliased to source so
// the demo runs without a prior library build; demo-kit supplies the shared
// Section + stylesheet from source too.
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: '@rxova/react-phone-input',
        replacement: fileURLToPath(new URL('../src/index.ts', import.meta.url)),
      },
      {
        find: '@rxova/demo-kit/styles.css',
        replacement: fileURLToPath(new URL('../../demo-kit/src/styles.css', import.meta.url)),
      },
      {
        find: /^@rxova\/demo-kit$/,
        replacement: fileURLToPath(new URL('../../demo-kit/src/index.ts', import.meta.url)),
      },
    ],
  },
  build: { outDir: 'dist', emptyOutDir: true },
  server: { port: 5279 },
  preview: { port: 4179 },
})
