import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// jsdom supports the storage and component tests. The source alias lets App's
// boundary test run from a fresh install before the library has been built.
export default defineConfig({
  resolve: {
    alias: [{
      find: /^@fix-portal\/ci-frontend$/,
      replacement: fileURLToPath(new URL('../../packages/ci-frontend/src/index.ts', import.meta.url)),
    }],
  },
  test: {
    environment: 'jsdom',
  },
})
