import { defineFunction } from '@aws-amplify/backend';

export const faithProcessor = defineFunction({
  name: 'faith-processor',
  entry: './handler.ts',
  timeoutSeconds: 12,
  memoryMB: 192,
  runtime: 20
});
