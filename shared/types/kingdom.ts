/**
 * Shared type definitions for Kingdom game entities.
 * Used by both Lambda handlers and frontend code.
 */

export interface KingdomResources {
  gold: number;
  population: number;
  mana: number;
  land: number;
  turns?: number;
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

export enum ErrorCode {
  MISSING_PARAMS = 'MISSING_PARAMS',
  INVALID_PARAM = 'INVALID_PARAM',
  NOT_FOUND = 'NOT_FOUND',
  INSUFFICIENT_RESOURCES = 'INSUFFICIENT_RESOURCES',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}
