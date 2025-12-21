import { defineFunction } from '@aws-amplify/backend';

export const combatProcessor = defineFunction({
  name: 'combat-processor',
  entry: './handler.ts',
  timeoutSeconds: 15,
  memoryMB: 256,
  runtime: 20
});
