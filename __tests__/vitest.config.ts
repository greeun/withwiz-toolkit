import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@withwiz/toolkit': resolve(__dirname, '../src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: [resolve(__dirname, './setup.ts')],
    exclude: ['node_modules', 'dist'],
  },
})
