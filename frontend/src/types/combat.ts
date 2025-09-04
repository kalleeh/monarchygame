/**
 * Combat System Types
 * TypeScript definitions for the Monarchy game combat system
 */

import type { RaceType } from './amplify';

export interface Army {
  peasants: number;
  militia: number;
  knights: number;
  cavalry: number;
  archers?: number;
  siege?: number;
  [unitType: string]: number | undefined;
}

export interface CombatStats {
  offense: number;
  defense: number;
  totalUnits: number;
  powerRating: number;
}

export interface Territory {
  id: string;
  name: string;
  coordinates: { x: number; y: number };
  kingdomId: string;
  kingdomName: string;
  fortificationLevel: number;
  buildings: Record<string, number>;
  units: Army;
  isCapital: boolean;
}

export interface Kingdom {
  id: string;
  name: string;
  race: RaceType;
  owner: string;
  resources: {
    gold: number;
    population: number;
    land: number;
    turns: number;
    mana?: number;
  };
  stats: {
    warOffense: number;
    warDefense: number;
    sorcery: number;
    scum: number;
    forts: number;
    tithe: number;
    training: number;
    siege: number;
    economy: number;
    building: number;
  };
  territories: Territory[];
  totalUnits: Army;
  isOnline: boolean;
  lastActive: Date;
}

export type AttackType = 'raid' | 'siege' | 'controlled_strike';

export interface AttackRequest {
  targetKingdomId: string;
  targetTerritoryId?: string;
  attackType: AttackType;
  army: Army;
  estimatedCasualties?: {
    attacker: Army;
    defender: Army;
  };
  estimatedOutcome?: 'victory' | 'defeat' | 'pyrrhic';
}

export interface CombatResult {
  success: boolean;
  attackType: AttackType;
  attacker: {
    kingdomId: string;
    kingdomName: string;
    race: RaceType;
    armyBefore: Army;
    armyAfter: Army;
    casualties: Army;
  };
  defender: {
    kingdomId: string;
    kingdomName: string;
    race: RaceType;
    armyBefore: Army;
    armyAfter: Army;
    casualties: Army;
    fortificationLevel: number;
  };
  spoils: {
    gold: number;
    population: number;
    land: number;
    buildings?: Record<string, number>;
  };
  battleReport: {
    rounds: BattleRound[];
    duration: number;
    terrain: string;
    weather?: string;
  };
  timestamp: Date;
}

export interface BattleRound {
  round: number;
  attackerDamage: number;
  defenderDamage: number;
  attackerLosses: Army;
  defenderLosses: Army;
  description: string;
}

export interface DefenseSettings {
  stance: 'aggressive' | 'balanced' | 'defensive';
  unitDistribution: {
    frontline: number; // percentage
    reserves: number; // percentage
    fortifications: number; // percentage
  };
  autoRetaliate: boolean;
  alertAlliance: boolean;
}

export interface CombatCalculationParams {
  attackerArmy: Army;
  defenderArmy: Army;
  attackerRace: RaceType;
  defenderRace: RaceType;
  attackerStats: Kingdom['stats'];
  defenderStats: Kingdom['stats'];
  fortificationLevel: number;
  attackType: AttackType;
  terrain?: 'plains' | 'forest' | 'mountains' | 'swamp' | 'desert';
  weather?: 'clear' | 'rain' | 'snow' | 'fog';
}

export interface UnitEffectiveness {
  [unitType: string]: {
    vs: {
      [targetUnit: string]: number; // multiplier
    };
    terrain: {
      [terrainType: string]: number; // multiplier
    };
    cost: {
      gold: number;
      population: number;
      turns: number;
    };
    stats: {
      offense: number;
      defense: number;
      speed: number;
      range?: number;
    };
  };
}

export interface BattleHistory {
  id: string;
  result: CombatResult;
  isAttacker: boolean;
  outcome: 'victory' | 'defeat' | 'pyrrhic';
  netGain: {
    gold: number;
    land: number;
    population: number;
  };
  timestamp: Date;
}

export interface CombatNotification {
  id: string;
  type: 'incoming_attack' | 'attack_result' | 'defense_result';
  message: string;
  kingdomName: string;
  attackType?: AttackType;
  estimatedArrival?: Date;
  result?: CombatResult;
  isRead: boolean;
  timestamp: Date;
}

// Combat calculation functions interface
export interface CombatEngine {
  calculateCombatPower: (army: Army, stats: Kingdom['stats'], isDefending?: boolean) => CombatStats;
  estimateBattleOutcome: (params: CombatCalculationParams) => {
    winProbability: number;
    estimatedCasualties: {
      attacker: Army;
      defender: Army;
    };
    estimatedSpoils: {
      gold: number;
      population: number;
      land: number;
    };
  };
  executeBattle: (params: CombatCalculationParams) => CombatResult;
  calculateFortificationBonus: (level: number) => number;
  calculateTerrainModifier: (terrain: string, unitType: string) => number;
}

// Error types for combat operations
export class CombatError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'CombatError';
  }
}

export class InsufficientArmyError extends CombatError {
  constructor(required: Army, available: Army) {
    super(
      'Insufficient army size for attack',
      'INSUFFICIENT_ARMY',
      { required, available }
    );
  }
}

export class InvalidTargetError extends CombatError {
  constructor(reason: string) {
    super(
      `Invalid attack target: ${reason}`,
      'INVALID_TARGET',
      { reason }
    );
  }
}

export class CooldownError extends CombatError {
  constructor(remainingTime: number) {
    super(
      `Attack is on cooldown for ${remainingTime} more minutes`,
      'ATTACK_COOLDOWN',
      { remainingTime }
    );
  }
}
