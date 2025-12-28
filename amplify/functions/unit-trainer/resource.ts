import { defineFunction } from '@aws-amplify/backend';

export const unitTrainer = defineFunction({
  name: 'unit-trainer',
  entry: './handler.ts',
  timeoutSeconds: 10,
  memoryMB: 128,
  runtime: 20
});
