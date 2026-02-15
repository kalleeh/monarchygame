import { defineFunction } from '@aws-amplify/backend';

export const resourceManager = defineFunction({
  name: 'resource-manager',
  entry: './handler.ts',
  timeoutSeconds: 10,
  memoryMB: 128,
  runtime: 20
});
