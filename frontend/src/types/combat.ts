// Terrain types
export const TerrainType = {
  PLAINS: 'PLAINS',
  FOREST: 'FOREST',
  MOUNTAINS: 'MOUNTAINS',
  SWAMP: 'SWAMP',
  DESERT: 'DESERT',
} as const;

export type TerrainType = typeof TerrainType[keyof typeof TerrainType];

// Army composition
export interface Army {
  [key: string]: number | undefined;
  peasants?: number;
  militia?: number;
  knights?: number;
  cavalry?: number;
  tier1?: number;
  tier2?: number;
  tier3?: number;
  tier4?: number;
  tier5?: number;
}

// Attack types
export type AttackType = 'controlled_strike' | 'ambush' | 'guerilla_raid' | 'mob_assault' | 'full_attack';

// Attack request
export interface AttackRequest {
  attackerId: string;
  defenderId: string;
  targetKingdomId?: string;
  targetTerritoryId?: string;
  attackType: AttackType;
  units: Army;
  formation?: string;
}

// Battle history
export interface BattleHistory {
  id: string;
  timestamp: Date;
  attackerId: string;
  defenderId: string;
  attacker: { 
    kingdomName: string;
    race?: string;
    armyBefore?: Army;
    armyAfter?: Army;
    casualties?: Army;
    fortificationLevel?: number;
  };
  defender: { 
    kingdomName: string;
    race?: string;
    armyBefore?: Army;
    armyAfter?: Army;
    casualties?: Army;
    fortificationLevel?: number;
  };
  outcome: 'victory' | 'defeat' | 'draw';
  result: {
    outcome: 'victory' | 'defeat' | 'draw';
    attacker: { 
      kingdomName: string;
      race?: string;
      armyBefore?: Army;
      armyAfter?: Army;
      casualties?: Army;
      fortificationLevel?: number;
    };
    defender: { 
      kingdomName: string;
      race?: string;
      armyBefore?: Army;
      armyAfter?: Army;
      casualties?: Army;
      fortificationLevel?: number;
    };
    attackType: AttackType;
    success?: boolean;
    spoils?: Record<string, number>;
    landGained?: number;
    battleReport?: {
      duration?: number;
      rounds?: number;
      details?: string;
    };
  };
  casualties: Record<string, number>;
  netGain?: {
    gold: number;
    land: number;
    population: number;
  };
  isAttacker?: boolean;
  attackType?: AttackType;
}

// Combat notification
export interface CombatNotification {
  id: string;
  type: 'attack' | 'defense' | 'victory' | 'defeat' | 'incoming_attack' | 'attack_result' | 'defense_result';
  message: string;
  timestamp: Date;
  read: boolean;
  isRead?: boolean;
  estimatedArrival?: Date;
  kingdomName?: string;
  attackType?: AttackType;
  result?: {
    outcome: 'victory' | 'defeat' | 'draw';
    attacker: string;
    defender: string;
    success?: boolean;
    spoils?: Record<string, number>;
  };
}

// Defense settings
export interface DefenseSettings {
  stance: 'aggressive' | 'balanced' | 'defensive';
  autoRecruit: boolean;
  alertThreshold: number;
  autoRetaliate?: boolean;
  alertAlliance?: boolean;
  unitDistribution?: {
    tier1?: number;
    tier2?: number;
    tier3?: number;
    tier4?: number;
    frontline?: number;
    reserves?: number;
    fortifications?: number;
  };
}

// Combat result
export interface CombatResult {
  success: boolean;
  outcome: 'victory' | 'defeat' | 'draw';
  landGained?: number;
  spoils?: {
    gold: number;
    population: number;
    land: number;
  };
  casualties?: {
    attacker: Army;
    defender: Army;
  };
  message?: string;
}

// Re-export Kingdom and Territory from kingdom.ts to avoid duplication
export type { Kingdom, Territory } from './kingdom';

// Formation types
export const FormationType = {
  DEFENSIVE_WALL: 'DEFENSIVE_WALL',
  CAVALRY_CHARGE: 'CAVALRY_CHARGE',
  BALANCED: 'BALANCED',
} as const;

export type FormationType = typeof FormationType[keyof typeof FormationType];

// Terrain effect definition
export interface TerrainEffect {
  type: TerrainType;
  name: string;
  description: string;
  icon: string;
  modifiers: {
    defense?: number;
    offense?: number;
    cavalry?: number;
    infantry?: number;
    siege?: number;
  };
}

// Formation template definition
export interface FormationTemplate {
  type: FormationType;
  name: string;
  description: string;
  icon: string;
  modifiers: {
    defense: number;
    offense: number;
  };
}

// Combat replay data
export interface CombatReplay {
  id: string;
  battleId: string;
  attackerId: string;
  attackerName: string;
  defenderId: string;
  defenderName: string;
  terrain: TerrainType;
  attackerFormation: FormationType;
  defenderFormation: FormationType;
  rounds: CombatRound[];
  result: 'victory' | 'defeat';
  landGained: number;
  timestamp: string;
}

export interface CombatRound {
  roundNumber: number;
  attackerCasualties: number;
  defenderCasualties: number;
  attackerUnitsRemaining: number;
  defenderUnitsRemaining: number;
}
