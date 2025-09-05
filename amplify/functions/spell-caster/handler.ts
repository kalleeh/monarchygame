import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../data/resource';
import { env } from '$amplify/env/spell-caster';

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
    const kingdom = await client.models.Kingdom.get({ id: event.casterId });
    if (!kingdom.data) throw new Error('Kingdom not found');

    const elanCost = event.spellCost || 3;
    const resources = kingdom.data.resources as { elan: number; [key: string]: number };
    
    if (resources.elan < elanCost) {
      throw new Error('Insufficient elan');
    }

    await client.models.Kingdom.update({
      id: event.casterId,
      resources: {
        ...resources,
        elan: resources.elan - elanCost
      }
    });

    return { success: true, spellCast: event.spellName };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return { success: false, error: errorMessage };
  }
};
