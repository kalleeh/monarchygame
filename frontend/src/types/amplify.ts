export interface AuthUser {
  attributes?: {
    email?: string;
    preferred_username?: string;
    given_name?: string;
    family_name?: string;
  };
}

export interface AuthenticatorProps {
  signOut?: () => void;
  user?: AuthUser;
}

export type RaceType = 'Human' | 'Elven' | 'Goblin' | 'Droben' | 'Vampire' | 'Elemental' | 'Centaur' | 'Sidhe' | 'Dwarven' | 'Fae';

// Canonical KingdomResources lives in shared/types/kingdom-resources.ts (enum-free,
// frontend-safe) — re-exported here so existing barrel/`../types/amplify` imports work.
export type { KingdomResources } from '../../../shared/types/kingdom-resources';
