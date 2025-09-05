import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../data/resource';
import { env } from '$amplify/env/territory-manager';

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
    const landCost = event.landCost || 1000;
    
    if (resources.gold < landCost) {
      throw new Error('Insufficient gold for territory expansion');
    }

    await client.models.Kingdom.update({
      id: event.kingdomId,
      resources: {
        ...resources,
        gold: resources.gold - landCost,
        land: resources.land + (event.landGain || 1)
      }
    });

    return { success: true, landGained: event.landGain || 1 };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
};
