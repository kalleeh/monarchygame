/**
 * Configures the Amplify library for Lambda functions using the project's
 * amplify_outputs.json which is regenerated on every deployment.
 *
 * The Gen2 generateClient<Schema>() requires model_introspection data that is
 * only available in amplify_outputs.json — it cannot be reconstructed from
 * just an AppSync endpoint URL.
 *
 * The file is bundled into the Lambda by esbuild at deploy time, so it always
 * reflects the current deployment's API IDs, region, and schema introspection.
 */
import { Amplify } from 'aws-amplify';
// amplify_outputs.json is at the project root — two levels up from amplify/functions/
// eslint-disable-next-line @typescript-eslint/no-require-imports
const outputs = require('../../amplify_outputs.json');

let configured = false;

export async function configureAmplify(): Promise<void> {
  if (configured) return;
  // Configure with the full outputs including model_introspection.
  // Override the default auth mode to IAM so Lambda's execution role is used.
  Amplify.configure({
    ...outputs,
    data: {
      ...outputs.data,
      default_authorization_type: 'AWS_IAM',
    },
  });
  configured = true;
}
