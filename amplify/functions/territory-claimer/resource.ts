import { defineFunction } from '@aws-amplify/backend';

export const territoryClaimer = defineFunction({
  name: 'territory-claimer',
  entry: './handler.ts',
  timeoutSeconds: 30,
  memoryMB: 512,
  runtime: 20
});
