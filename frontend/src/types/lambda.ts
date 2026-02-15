// Lambda response types
export interface LambdaResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Combat Lambda responses
export interface CombatLambdaResponse {
  success: boolean;
  goldLooted?: number;
  landGained?: number;
  casualties: {
    attacker: Record<string, number>;
    defender: Record<string, number>;
  };
  result: 'victory' | 'defeat' | 'draw';
}

// Spell Lambda responses  
export interface SpellLambdaResponse {
  success: boolean;
  spellId: string;
  targetId: string;
  effect: string;
  duration: number;
  manaCost: number;
  cooldown: number;
}

// Training Lambda responses
export interface TrainingLambdaResponse {
  success: boolean;
  queueId?: string;
  completionTime?: string;
  goldCost?: number;
  populationCost?: number;
  message?: string;
}
