import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { combatProcessor } from './functions/combat-processor/resource';
import { territoryManager } from './functions/territory-manager/resource';
import { buildingConstructor } from './functions/building-constructor/resource';
import { unitTrainer } from './functions/unit-trainer/resource';
import { spellCaster } from './functions/spell-caster/resource';
import { resourceManager } from './functions/resource-manager/resource';

export const backend = defineBackend({
  auth,
  data,
  combatProcessor,
  territoryManager,
  buildingConstructor,
  unitTrainer,
  spellCaster,
  resourceManager
});

// Grant all Lambda functions access to the data layer
backend.data.addDatabaseAccess(backend.combatProcessor);
backend.data.addDatabaseAccess(backend.territoryManager);
backend.data.addDatabaseAccess(backend.buildingConstructor);
backend.data.addDatabaseAccess(backend.unitTrainer);
backend.data.addDatabaseAccess(backend.spellCaster);
backend.data.addDatabaseAccess(backend.resourceManager);
