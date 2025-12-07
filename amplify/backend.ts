import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { combatProcessor } from './functions/combat-processor/resource';
import { resourceManager } from './functions/resource-manager/resource';
import { buildingConstructor } from './functions/building-constructor/resource';
import { unitTrainer } from './functions/unit-trainer/resource';
import { spellCaster } from './functions/spell-caster/resource';
import { territoryClaimer } from './functions/territory-claimer/resource';

export const backend = defineBackend({
  auth,
  data,
  combatProcessor,
  resourceManager,
  buildingConstructor,
  unitTrainer,
  spellCaster,
  territoryClaimer
});
