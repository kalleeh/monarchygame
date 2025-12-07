import { defineFunction } from '@aws-amplify/backend';

export const unitTrainer = defineFunction({
  name: 'unit-trainer',
  entry: './handler.ts',
  timeoutSeconds: 30,
  memoryMB: 512,
  runtime: 20
});
