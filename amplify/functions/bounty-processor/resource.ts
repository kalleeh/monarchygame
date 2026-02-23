import { defineFunction } from '@aws-amplify/backend';

export const bountyProcessor = defineFunction({
  name: 'bounty-processor',
  entry: './handler.ts',
  timeoutSeconds: 12,
  memoryMB: 192,
  runtime: 20
});
