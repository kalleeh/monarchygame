import { defineFunction } from '@aws-amplify/backend';

export const buildingConstructor = defineFunction({
  name: 'building-constructor',
  entry: './handler.ts',
  timeoutSeconds: 10,
  memoryMB: 128,
  runtime: 20
});
