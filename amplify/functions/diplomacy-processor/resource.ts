import { defineFunction } from '@aws-amplify/backend';

export const diplomacyProcessor = defineFunction({
  name: 'diplomacy-processor',
  entry: './handler.ts',
  timeoutSeconds: 15,
  memoryMB: 256,
  runtime: 20
});
