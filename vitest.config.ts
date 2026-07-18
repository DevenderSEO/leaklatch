import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/detect/**/*.ts', 'src/allowlist.ts', 'src/baseline.ts', 'src/config.ts'],
      exclude: ['src/cli.ts', 'src/index.ts', 'dist/**'],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90,
      },
    },
  },
});
