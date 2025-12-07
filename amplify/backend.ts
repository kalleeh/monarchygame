import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { combatProcessor } from './functions/combat-processor/resource';

export const backend = defineBackend({
  auth,
  data,
  combatProcessor
});
