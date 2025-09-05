import { defineFunction } from '@aws-amplify/backend';

export const buildingConstructor = defineFunction({
  name: 'building-constructor',
  entry: './handler.ts',
  runtime: 20,
  timeoutSeconds: 30,
  memoryMB: 512,
  logging: {
    format: 'json',
    level: 'info',
    retention: '1 week'
  },
  bundling: {
    minify: true
  },
  environment: {
    NODE_ENV: 'production'
  }
});
