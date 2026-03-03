import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

const alias = {
  '@withwiz': resolve(__dirname, './src'),
}

export default defineConfig({
  resolve: {
    alias,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./__tests__/setup.ts'],
    exclude: ['node_modules', 'dist'],
  },
})
