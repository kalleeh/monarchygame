import { defineFunction } from '@aws-amplify/backend';

export const buildingConstructor = defineFunction({
  name: 'building-constructor',
  entry: './handler.ts',
  timeoutSeconds: 30,
  memoryMB: 512,
  runtime: 20
});
