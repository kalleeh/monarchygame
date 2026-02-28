/**
 * Call this once at the top of every Lambda handler before generateClient().
 * It reads AMPLIFY_DATA_GRAPHQL_ENDPOINT (injected by CDK via backend.ts)
 * and configures the Amplify library for IAM-authenticated AppSync access.
 */
import { Amplify } from 'aws-amplify';

let configured = false;

export function configureAmplify(): void {
  if (configured) return;
  const endpoint = process.env.AMPLIFY_DATA_GRAPHQL_ENDPOINT;
  if (!endpoint) {
    console.warn('[amplify-configure] AMPLIFY_DATA_GRAPHQL_ENDPOINT not set – generateClient calls will fail');
    return;
  }
  Amplify.configure({
    API: {
      GraphQL: {
        endpoint,
        region: process.env.AWS_REGION ?? 'eu-west-1',
        defaultAuthMode: 'iam',
      },
    },
  });
  configured = true;
}
