import { defineConfig } from 'tsup'
import { copyFileSync } from 'node:fs'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ['react', 'react-dom', '@tanstack/react-query'],
  // tsup types the hook as returning a Promise, so it stays async although it only copies files.
  // eslint-disable-next-line @typescript-eslint/require-await
  onSuccess: async () => {
    copyFileSync('src/styles/board.css', 'dist/board.css')
    copyFileSync('src/styles/tokens.css', 'dist/tokens.css')
  },
})
