import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { combatProcessor } from './functions/combat-processor/resource';
import { resourceManager } from './functions/resource-manager/resource';
import { buildingConstructor } from './functions/building-constructor/resource';
import { unitTrainer } from './functions/unit-trainer/resource';
import { spellCaster } from './functions/spell-caster/resource';
import { territoryClaimer } from './functions/territory-claimer/resource';
import { seasonManager } from './functions/season-manager/resource';
import { warManager } from './functions/war-manager/resource';
import { tradeProcessor } from './functions/trade-processor/resource';
import { diplomacyProcessor } from './functions/diplomacy-processor/resource';
import { seasonLifecycle } from './functions/season-lifecycle/resource';
import { thieveryProcessor } from './functions/thievery-processor/resource';
import { faithProcessor } from './functions/faith-processor/resource';
import { bountyProcessor } from './functions/bounty-processor/resource';
import { allianceTreasury } from './functions/alliance-treasury/resource';
import { allianceManager } from './functions/alliance-manager/resource';

export const backend = defineBackend({
  auth,
  data,
  combatProcessor,
  resourceManager,
  buildingConstructor,
  unitTrainer,
  spellCaster,
  territoryClaimer,
  seasonManager,
  warManager,
  tradeProcessor,
  diplomacyProcessor,
  seasonLifecycle,
  thieveryProcessor,
  faithProcessor,
  bountyProcessor,
  allianceTreasury,
  allianceManager
});

// Inject the AppSync GraphQL endpoint into every Lambda so they can call
// Amplify.configure() before using generateClient<Schema>().
const lambdaFunctions = [
  backend.combatProcessor,
  backend.resourceManager,
  backend.buildingConstructor,
  backend.unitTrainer,
  backend.spellCaster,
  backend.territoryClaimer,
  backend.seasonManager,
  backend.warManager,
  backend.tradeProcessor,
  backend.diplomacyProcessor,
  backend.seasonLifecycle,
  backend.thieveryProcessor,
  backend.faithProcessor,
  backend.bountyProcessor,
  backend.allianceTreasury,
  backend.allianceManager,
];

for (const fn of lambdaFunctions) {
  fn.addEnvironment('AMPLIFY_DATA_GRAPHQL_ENDPOINT', backend.data.graphqlUrl);
}

// CDK escape hatch: prevent the Cognito UserPool Schema from being updated.
// Cognito does not allow changing attribute definitions (AttributeDataType,
// Mutable, Required) after the User Pool is created. Newer versions of
// @aws-amplify/backend-auth generate CDK code that tries to update the Schema,
// which causes CloudFormation to fail with "Invalid AttributeDataType input".
// Clearing the Schema override tells CloudFormation to leave it unchanged.
backend.auth.resources.cfnResources.cfnUserPool.addPropertyOverride('Schema', undefined);
