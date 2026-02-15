import { defineFunction } from '@aws-amplify/backend';

export const seasonManager = defineFunction({
  name: 'season-manager',
  entry: './handler.ts',
  timeoutSeconds: 15,
  memoryMB: 256,
  runtime: 20
});
