import { defineFunction } from '@aws-amplify/backend';

export const combatProcessor = defineFunction({
  name: 'combat-processor',
  entry: './handler.ts',
  timeoutSeconds: 30,
  memoryMB: 512,
  runtime: 20
});
