import { defineFunction } from '@aws-amplify/backend';

export const spellCaster = defineFunction({
  name: 'spell-caster',
  entry: './handler.ts',
  timeoutSeconds: 12,
  memoryMB: 192,
  runtime: 20
});
