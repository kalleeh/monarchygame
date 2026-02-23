import { defineFunction } from '@aws-amplify/backend';

export const thieveryProcessor = defineFunction({
  name: 'thievery-processor',
  entry: './handler.ts',
  timeoutSeconds: 12,
  memoryMB: 192,
  runtime: 20
});
