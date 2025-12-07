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

export interface KingdomResources {
  gold: number;
  population: number;
  land: number;
  turns: number;
}
