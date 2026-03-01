import { defineBackend } from '@aws-amplify/backend';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as cdk from 'aws-cdk-lib';
import { turnTicker } from './functions/turn-ticker/resource';
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
  allianceManager,
  turnTicker,
});

// Grant all Lambda functions permission to discover the AppSync endpoint at runtime.
// We cannot inject backend.data.graphqlUrl directly (creates circular CDK dependency
// between data↔function nested stacks). Instead, Lambdas call appsync:ListGraphqlApis
// to find their own endpoint on first invocation.
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
  backend.turnTicker,
];

for (const fn of lambdaFunctions) {
  fn.resources.lambda.addToRolePolicy(
    new iam.PolicyStatement({
      actions: ['appsync:ListGraphqlApis'],
      resources: ['*'],
    })
  );
}

// Grant all Lambda functions direct DynamoDB access so they can use data-client.ts
// (replacing the generateClient<Schema>() Amplify frontend pattern which requires
// model_introspection that is unavailable inside Lambda bundles).
for (const fn of lambdaFunctions) {
  fn.resources.lambda.addToRolePolicy(
    new iam.PolicyStatement({
      actions: [
        'dynamodb:GetItem',
        'dynamodb:PutItem',
        'dynamodb:UpdateItem',
        'dynamodb:DeleteItem',
        'dynamodb:Query',
        'dynamodb:Scan',
        'dynamodb:BatchGetItem',
        'dynamodb:BatchWriteItem',
        'dynamodb:ListTables',
      ],
      resources: ['*'],
    })
  );
}

// ── Scheduled EventBridge rules ──────────────────────────────────────────────

// Season check — every hour.
// Advances age (early→middle→late) and closes expired seasons automatically.
const seasonStack = cdk.Stack.of(backend.seasonLifecycle.resources.lambda);

const seasonCheckRule = new events.Rule(seasonStack, 'SeasonCheckSchedule', {
  schedule: events.Schedule.rate(cdk.Duration.hours(1)),
  description: 'Hourly: advance season ages and close expired seasons',
  enabled: true,
});
seasonCheckRule.addTarget(
  new targets.LambdaFunction(backend.seasonLifecycle.resources.lambda, {
    event: events.RuleTargetInput.fromObject({
      arguments: { action: 'check' },
      identity: { sub: 'scheduler', username: 'scheduler' },
      source: 'scheduler',
      request: { headers: {} },
    }),
    retryAttempts: 2,
  })
);

// Turn ticker — every 20 minutes (= 3 turns/hour, matching TURNS_PER_HOUR).
// Grants +1 turn to every active kingdom so offline players accumulate turns.
const tickerStack = cdk.Stack.of(backend.turnTicker.resources.lambda);

const turnTickRule = new events.Rule(tickerStack, 'TurnTickSchedule', {
  schedule: events.Schedule.rate(cdk.Duration.minutes(20)),
  description: 'Every 20 min: +1 turn for all active kingdoms (3/hour)',
  enabled: true,
});
turnTickRule.addTarget(
  new targets.LambdaFunction(backend.turnTicker.resources.lambda, {
    event: events.RuleTargetInput.fromObject({ source: 'scheduler' }),
    retryAttempts: 1,
  })
);

// CDK escape hatch: prevent the Cognito UserPool Schema from being updated.
// Cognito does not allow changing attribute definitions (AttributeDataType,
// Mutable, Required) after the User Pool is created. Newer versions of
// @aws-amplify/backend-auth generate CDK code that tries to update the Schema,
// which causes CloudFormation to fail with "Invalid AttributeDataType input".
// Clearing the Schema override tells CloudFormation to leave it unchanged.
backend.auth.resources.cfnResources.cfnUserPool.addPropertyOverride('Schema', undefined);
