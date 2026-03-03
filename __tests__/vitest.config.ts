import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

const alias = {
  '@withwiz': resolve(__dirname, '../src'),
}

export default defineConfig({
  resolve: {
    alias,
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: [resolve(__dirname, './setup.ts')],
    exclude: ['node_modules', 'dist'],
  },
})
