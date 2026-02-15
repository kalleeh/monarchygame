export interface AIPersonality {
  name: string;
  weights: {
    economic: number;
    military: number;
    magical: number;
    diplomatic: number;
    territorial: number;
  };
  aggression: number; // 0-1
  riskTolerance: number; // 0-1
}

export interface GameState {
  kingdoms: KingdomState[];
  turn: number;
  gamePhase: 'early' | 'mid' | 'late';
}

export interface KingdomState {
  id: string;
  race: string;
  resources: { gold: number; land: number; mana: number; };
  military: { units: number; power: number; };
  buildings: Record<string, number>;
  alliances: string[];
  isAI: boolean;
}

export interface Decision {
  type: 'build' | 'attack' | 'cast' | 'trade' | 'expand';
  target?: string;
  priority: number;
  expectedUtility: number;
}

export interface BalanceMetrics {
  raceWinRates: Record<string, number>;
  avgGameLength: number;
  dominantStrategies: string[];
  balanceScore: number; // 0-100, higher = more balanced
}