import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['amplify/functions/**/*.test.ts'],
    setupFiles: ['amplify/functions/test-utils.ts'],
    clearMocks: true,
    restoreMocks: true,
    unstubGlobals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['amplify/functions/**/handler.ts'],
      exclude: [
        'amplify/functions/**/*.test.ts', 
        'amplify/functions/test-utils.ts',
        'amplify/functions/node_modules/**'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    }
  }
});
