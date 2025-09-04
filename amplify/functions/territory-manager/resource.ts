import { defineFunction } from '@aws-amplify/backend';

export const territoryManager = defineFunction({
  name: 'territory-manager',
  entry: './handler.ts',
  runtime: 20,
  timeoutSeconds: 30,
  memoryMB: 512,
  logging: {
    format: 'json',
    level: 'info',
    retention: 'ONE_WEEK'
  },
  bundling: {
    minify: true
  },
  environment: {
    NODE_ENV: 'production'
  }
});
