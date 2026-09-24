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
      // honest. Rebased below the 2026-09-24 actuals (93/89/92/94) to retain
      // regression headroom while preventing the old, now-stale 60% floors from
      // allowing coverage to fall back toward the original baseline.
      thresholds: {
        statements: 90,
        branches: 85,
        functions: 90,
        lines: 90,
      },
    },
  },
})
