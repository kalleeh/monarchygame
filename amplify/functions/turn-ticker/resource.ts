import { defineFunction } from '@aws-amplify/backend';

export const turnTicker = defineFunction({
  name: 'turn-ticker',
  entry: './handler.ts',
  timeoutSeconds: 60,   // up to ~500 kingdoms in 60 s
  memoryMB: 256,
  runtime: 20,
});
