import { defineFunction } from '@aws-amplify/backend';

export const allianceTreasury = defineFunction({
  name: 'alliance-treasury',
  entry: './handler.ts',
  timeoutSeconds: 12,
  memoryMB: 192,
  runtime: 20
});
