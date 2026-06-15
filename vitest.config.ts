import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

// Vitest runs without the CRXJS/manifest pipeline — it only needs module
// resolution and a DOM environment for the occasional component test.
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
