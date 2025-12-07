import { defineFunction } from '@aws-amplify/backend';

export const resourceManager = defineFunction({
  name: 'resource-manager',
  entry: './handler.ts',
  timeoutSeconds: 30,
  memoryMB: 512,
  runtime: 20
});
