import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['**/*.compat.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    testTimeout: 10_000,
  },
});
