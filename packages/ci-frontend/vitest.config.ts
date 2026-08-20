import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    css: false,
    // NOTE: `globals: true` is deliberately NOT set. Tests import { describe, it,
    // expect } from 'vitest' explicitly. This matters for ArchUnitTS -- see
    // architecture.archunit.ts for why the no-globals choice drives the wrapper.
    coverage: {
      provider: 'v8',
      // Scope coverage to source. Without an explicit include, v8 reports only
      // files a test touched, so untested src files sit outside the denominator
      // and the thresholds below pass vacuously.
      include: ['src/**'],
      reporter: ['text', 'html'],
      // Floors measured over ALL of src (the include glob above), so they are
      // honest. Set just under the current actuals (63/51/66/61) so a regression
      // trips CI; ratchet up as the presentational shell (CiBoard, pages/*,
      // useDashboardSnapshot) gains tests. NB: the old 70% floors passed only
      // because, without `include`, v8 counted just the files a test imported.
      thresholds: {
        statements: 60,
        branches: 50,
        functions: 65,
        lines: 60,
      },
    },
  },
})
