import { defineFunction } from '@aws-amplify/backend';

export const tradeProcessor = defineFunction({
  name: 'trade-processor',
  entry: './handler.ts',
  timeoutSeconds: 15,
  memoryMB: 256,
  runtime: 20
});
