import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/e2e/**', 'node_modules/**', 'dist/**'],
    coverage: {
      provider: 'v8',
      // Seuils imposés sur le noyau seul (spec T-001 §9, T-003) : un manque fait échouer test:cov.
      include: ['src/sim/**/*.ts'],
      reporter: ['text'],
      thresholds: { lines: 95, branches: 90 },
    },
  },
});
