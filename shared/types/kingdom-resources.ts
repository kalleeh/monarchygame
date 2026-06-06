/**
 * Pure (enum-free) Kingdom data interfaces.
 *
 * Split out of kingdom.ts so the frontend can import these types without pulling
 * in the `ErrorCode` enum, which violates the frontend's `erasableSyntaxOnly`
 * tsconfig setting. kingdom.ts re-exports everything here for backend callers.
 */

export interface KingdomResources {
  gold: number;
  population: number;
  elan?: number;
  mana?: number;
  land: number;
  turns: number;
  // Index signature enables safe dynamic access (resources[resourceId]) without
  // `as unknown as Record<string, number>` casts. All declared fields are numeric.
  [key: string]: number | undefined;
}

export interface KingdomBuildings {
  castle?: number;
  barracks?: number;
  farm?: number;
  mine?: number;
  temple?: number;
  tower?: number;
  wall?: number;
}

export interface KingdomUnits {
  infantry?: number;
  archers?: number;
  cavalry?: number;
  siege?: number;
  mages?: number;
  scouts?: number;
  elite_scouts?: number;
}

export interface CombatResultData {
  result: string;
  powerRatio: number;
  casualties: {
    attacker: Record<string, number>;
    defender: Record<string, number>;
  };
  landGained: number;
  goldLooted: number;
  success: boolean;
}
