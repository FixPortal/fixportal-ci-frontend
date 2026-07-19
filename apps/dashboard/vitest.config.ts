import { defineConfig } from 'vitest/config'

// Minimal config — apps/dashboard had no test setup at all (CIF-H3). jsdom gives
// readAdminSignal's test access to window.location/localStorage; no coverage
// thresholds or setupFiles are needed since the only test here calls a plain
// function, not a rendered component.
export default defineConfig({
  test: {
    environment: 'jsdom',
  },
})
