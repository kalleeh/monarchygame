import { defineFunction } from '@aws-amplify/backend';

export const seasonLifecycle = defineFunction({
  name: 'season-lifecycle',
  entry: './handler.ts',
  timeoutSeconds: 30,
  memoryMB: 256,
  runtime: 20
});
