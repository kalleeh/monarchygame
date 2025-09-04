import { defineFunction } from '@aws-amplify/backend';

export const combatProcessor = defineFunction({
  name: 'combat-processor',
  entry: './handler.ts',
  runtime: 20,
  timeoutSeconds: 30,
  memoryMB: 512,
  // Best Practice: Proper logging configuration
  logging: {
    format: 'json',
    level: 'info',
    retention: 'ONE_WEEK'
  },
  // Best Practice: Bundling optimization
  bundling: {
    minify: true
  },
  // Best Practice: Environment variables will be auto-injected by Amplify
  environment: {
    NODE_ENV: 'production'
  }
});
