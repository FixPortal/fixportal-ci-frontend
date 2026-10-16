export default {
  cacheDir: '.vite-cache',
  test: { environment: 'jsdom', include: ['src/**/*.test.js'], setupFiles: ['./observer.mjs'] },
}
