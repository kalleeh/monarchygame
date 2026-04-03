import { defineFunction } from '@aws-amplify/backend';

export const kingdomCleanup = defineFunction({
  name: 'kingdom-cleanup',
  entry: './handler.ts',
  timeoutSeconds: 30,
  memoryMB: 256,
  runtime: 20,
});
