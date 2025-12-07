import { defineFunction } from '@aws-amplify/backend';

export const spellCaster = defineFunction({
  name: 'spell-caster',
  entry: './handler.ts',
  timeoutSeconds: 30,
  memoryMB: 512,
  runtime: 20
});
