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
import { kingdomCleanup } from './functions/kingdom-cleanup/resource';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import { SnsAction } from 'aws-cdk-lib/aws-cloudwatch-actions';

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
  kingdomCleanup,
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
  backend.kingdomCleanup,
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

// Grant all Lambda functions DynamoDB access scoped to this app's tables.
// Amplify Gen 2 tables follow: arn:aws:dynamodb:<region>:<account>:table/<Model>-<apiId>-NONE
// We scope to tables ending in '-NONE' within this account/region.
const dataStack = cdk.Stack.of(backend.data.resources.graphqlApi);
const tableArnPattern = `arn:aws:dynamodb:${dataStack.region}:${dataStack.account}:table/*-NONE`;

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
      resources: [
        tableArnPattern,
        `${tableArnPattern}/index/*`,
      ],
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

// ── Production Monitoring ────────────────────────────────────────────────

const monitoringStack = backend.createStack('monitoring');

// SNS topic for alerts (subscribe via AWS Console or CLI)
const alertTopic = new sns.Topic(monitoringStack, 'GameAlerts', {
  displayName: 'Monarchy Game Alerts',
});

// Lambda error alarm — fires when any function errors ≥5 times in 5 minutes
const lambdaErrorAlarm = new cloudwatch.Alarm(monitoringStack, 'LambdaErrorAlarm', {
  metric: new cloudwatch.Metric({
    namespace: 'AWS/Lambda',
    metricName: 'Errors',
    statistic: 'Sum',
    period: cdk.Duration.minutes(5),
  }),
  threshold: 5,
  evaluationPeriods: 1,
  alarmDescription: 'Lambda errors ≥5 in 5 minutes',
  treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
});
lambdaErrorAlarm.addAlarmAction(new SnsAction(alertTopic));

// Lambda duration alarm — fires when p99 latency exceeds 10s
const lambdaDurationAlarm = new cloudwatch.Alarm(monitoringStack, 'LambdaDurationAlarm', {
  metric: new cloudwatch.Metric({
    namespace: 'AWS/Lambda',
    metricName: 'Duration',
    statistic: 'p99',
    period: cdk.Duration.minutes(5),
  }),
  threshold: 10000,
  evaluationPeriods: 2,
  alarmDescription: 'Lambda p99 duration >10s for 10 minutes',
  treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
});
lambdaDurationAlarm.addAlarmAction(new SnsAction(alertTopic));

// DynamoDB throttle alarm
const dynamoThrottleAlarm = new cloudwatch.Alarm(monitoringStack, 'DynamoThrottleAlarm', {
  metric: new cloudwatch.Metric({
    namespace: 'AWS/DynamoDB',
    metricName: 'ThrottledRequests',
    statistic: 'Sum',
    period: cdk.Duration.minutes(5),
  }),
  threshold: 10,
  evaluationPeriods: 1,
  alarmDescription: 'DynamoDB throttled requests ≥10 in 5 minutes',
  treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
});
dynamoThrottleAlarm.addAlarmAction(new SnsAction(alertTopic));

// CloudWatch Dashboard
new cloudwatch.Dashboard(monitoringStack, 'GameDashboard', {
  dashboardName: 'MonarchyGame',
  widgets: [
    [
      new cloudwatch.GraphWidget({
        title: 'Lambda Invocations',
        left: [new cloudwatch.Metric({ namespace: 'AWS/Lambda', metricName: 'Invocations', statistic: 'Sum', period: cdk.Duration.minutes(5) })],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'Lambda Errors',
        left: [new cloudwatch.Metric({ namespace: 'AWS/Lambda', metricName: 'Errors', statistic: 'Sum', period: cdk.Duration.minutes(5) })],
        width: 12,
      }),
    ],
    [
      new cloudwatch.GraphWidget({
        title: 'Lambda Duration (p50/p99)',
        left: [
          new cloudwatch.Metric({ namespace: 'AWS/Lambda', metricName: 'Duration', statistic: 'p50', period: cdk.Duration.minutes(5) }),
          new cloudwatch.Metric({ namespace: 'AWS/Lambda', metricName: 'Duration', statistic: 'p99', period: cdk.Duration.minutes(5) }),
        ],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'DynamoDB Throttles',
        left: [new cloudwatch.Metric({ namespace: 'AWS/DynamoDB', metricName: 'ThrottledRequests', statistic: 'Sum', period: cdk.Duration.minutes(5) })],
        width: 12,
      }),
    ],
  ],
});

// CDK escape hatch: prevent the Cognito UserPool Schema from being updated.
// Cognito does not allow changing attribute definitions (AttributeDataType,
// Mutable, Required) after the User Pool is created. Newer versions of
// @aws-amplify/backend-auth generate CDK code that tries to update the Schema,
// which causes CloudFormation to fail with "Invalid AttributeDataType input".
// Clearing the Schema override tells CloudFormation to leave it unchanged.
backend.auth.resources.cfnResources.cfnUserPool.addPropertyOverride('Schema', undefined);
