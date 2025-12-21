import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { Stack } from 'aws-cdk-lib';
import { Alarm, Metric } from 'aws-cdk-lib/aws-cloudwatch';
import { SnsAction } from 'aws-cdk-lib/aws-cloudwatch-actions';
import { Topic } from 'aws-cdk-lib/aws-sns';

const backend = defineBackend({
  auth,
  data,
});

// Add monitoring
const monitoringStack = backend.createStack('monitoring');

// SNS topic for alerts
const alertTopic = new Topic(monitoringStack, 'AlertTopic', {
  displayName: 'Monarchy Game Alerts',
});

// API Gateway error rate alarm
new Alarm(monitoringStack, 'ApiErrorAlarm', {
  metric: new Metric({
    namespace: 'AWS/ApiGateway',
    metricName: '4XXError',
    dimensionsMap: {
      ApiName: 'monarchy-game-api',
    },
  }),
  threshold: 10,
  evaluationPeriods: 2,
}).addAlarmAction(new SnsAction(alertTopic));

// Lambda error rate alarm
new Alarm(monitoringStack, 'LambdaErrorAlarm', {
  metric: new Metric({
    namespace: 'AWS/Lambda',
    metricName: 'Errors',
  }),
  threshold: 5,
  evaluationPeriods: 2,
}).addAlarmAction(new SnsAction(alertTopic));