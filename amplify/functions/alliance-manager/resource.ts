import { defineFunction } from '@aws-amplify/backend';

export const allianceManager = defineFunction({
  name: 'alliance-manager',
  entry: './handler.ts',
  timeoutSeconds: 12,
  memoryMB: 192,
  runtime: 20
});
