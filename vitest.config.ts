import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: ['to-*/vitest.config.ts'],
  },
})
