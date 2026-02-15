/**
 * Phase 3: Optimized Vitest Configuration for Balance Testing
 * IQC: Performance-focused testing with concurrent execution
 */
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    pool: 'threads', // Use threads for better performance
    poolOptions: {
      threads: {
        singleThread: false, // Enable multi-threading
      }
    },
    isolate: false, // Disable isolation for speed
    include: ['src/balance-testing/**/*.test.ts'],
    testTimeout: 60000, // 60s timeout for balance tests
    hookTimeout: 10000, // 10s hook timeout
    teardownTimeout: 5000, // 5s teardown timeout
    concurrent: true, // Enable concurrent by default
    maxConcurrency: 10, // Limit concurrent tests
    reporter: ['verbose', 'json'],
    outputFile: {
      json: './balance-test-results.json'
    }
  }
})
