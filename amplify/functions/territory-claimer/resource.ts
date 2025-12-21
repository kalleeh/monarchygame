import { defineFunction } from '@aws-amplify/backend';

export const territoryClaimer = defineFunction({
  name: 'territory-claimer',
  entry: './handler.ts',
  timeoutSeconds: 10,
  memoryMB: 128,
  runtime: 20
});
