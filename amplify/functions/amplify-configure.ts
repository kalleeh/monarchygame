/**
 * Async Amplify configuration for Lambda functions.
 *
 * Cannot inject the GraphQL endpoint via CDK env vars because the data stack
 * and function stack have a circular dependency (data→function via resolvers,
 * function→data via endpoint). Instead, we discover the endpoint at runtime
 * using the AppSync ListGraphqlApis API (IAM permission granted in backend.ts).
 *
 * Result is cached after first call (warm Lambda invocations skip the API call).
 */
import { Amplify } from 'aws-amplify';
import { AppSyncClient, ListGraphqlApisCommand } from '@aws-sdk/client-appsync';

let configuredEndpoint: string | undefined;

export async function configureAmplify(): Promise<void> {
  if (configuredEndpoint) return;

  const region = process.env.AWS_REGION ?? 'eu-west-1';

  // Fast path: endpoint injected as env var (e.g. set manually or in future CDK fix)
  const envEndpoint = process.env.AMPLIFY_DATA_GRAPHQL_ENDPOINT;
  if (envEndpoint) {
    configuredEndpoint = envEndpoint;
  } else {
    // Discovery path: find the correct amplifyData AppSync API.
    // Filter by amplify:app-id tag to avoid picking up sandbox or old deployments
    // that also have name === 'amplifyData'.
    const APP_ID = 'd2plhaotxy4zdr';
    const appsync = new AppSyncClient({ region });
    const { graphqlApis } = await appsync.send(new ListGraphqlApisCommand({}));
    const api = graphqlApis?.find(
      a => a.name === 'amplifyData' && a.tags?.['amplify:app-id'] === APP_ID
    );
    if (!api?.uris?.GRAPHQL) {
      throw new Error('[amplify-configure] Could not find amplifyData AppSync API for app ' + APP_ID);
    }
    configuredEndpoint = api.uris.GRAPHQL;
  }

  Amplify.configure({
    API: {
      GraphQL: {
        endpoint: configuredEndpoint,
        region,
        defaultAuthMode: 'iam',
      },
    },
  });
}
