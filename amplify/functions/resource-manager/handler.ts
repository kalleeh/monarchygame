import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../data/resource';
import { env } from '$amplify/env/resource-manager';

// Configure Amplify client for Lambda
Amplify.configure({
  API: {
    GraphQL: {
      endpoint: env.AMPLIFY_DATA_GRAPHQL_ENDPOINT || '',
      region: env.AWS_REGION || 'us-east-1',
      defaultAuthMode: 'iam'
    }
  }
}, {
  Auth: {
    credentialsProvider: {
      getCredentialsAndIdentityId: async () => ({
        credentials: {
          accessKeyId: env.AWS_ACCESS_KEY_ID || '',
          secretAccessKey: env.AWS_SECRET_ACCESS_KEY || '',
          sessionToken: env.AWS_SESSION_TOKEN || '',
        },
      }),
      clearCredentialsAndIdentityId: () => {
        /* noop */
      },
    },
  },
});

const client = generateClient<Schema>();

export const handler = async (event: any) => {
  try {
    const kingdom = await client.models.Kingdom.get({ id: event.kingdomId });
    if (!kingdom.data) throw new Error('Kingdom not found');

    const resources = kingdom.data.resources as any;
    let updatedResources = { ...resources };
    
    // Apply resource updates based on event
    if (event.goldChange) updatedResources.gold += event.goldChange;
    if (event.populationChange) updatedResources.population += event.populationChange;
    if (event.landChange) updatedResources.land += event.landChange;

    await client.models.Kingdom.update({
      id: event.kingdomId,
      resources: updatedResources
    });

    return { success: true, resources: updatedResources };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
};
