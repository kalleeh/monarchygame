import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';

let _client: ReturnType<typeof generateClient<Schema>> | null = null;

/** Singleton Amplify Data client. Safe to call multiple times. */
export function getClient() {
  if (!_client) _client = generateClient<Schema>();
  return _client;
}
