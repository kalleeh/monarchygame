/**
 * Game Mechanics Adapter
 * Provides complete game mechanics for balance testing with authentic race data
 */

export interface RaceData {
  name: string;
  war: number;      // 1-5 scale
  sorcery: number;  // 1-5 scale  
  scum: number;     // 1-5 scale
  defense: number;  // 1-5 scale
  economy: number;  // 1-5 scale
  multipliers: {
    economy: number;
    military: number;
    magic: number;
  };
}

export interface UnitTypes {
  peasants: number;
  militia: number;
  knights: number;
  warOffense: number;
  scum: number;
}

export interface GameMechanics {
  calculateCombatResult: (attacker: Record<string, unknown>, defender: Record<string, unknown>) => Record<string, unknown>;
  calculateLandGained: (attackerOffense: number, defenderDefense: number, targetLand: number) => number;
  calculateBuildRate: (quarryPercentage: number) => number;
  getRacialBonuses: (race: string) => RaceData;
  RACES: Record<string, RaceData>;
}

export function initializeGameMechanics(): GameMechanics {
  return {
    // Complete race definitions from knowledge base
    RACES: {
      Human: { 
        name: 'Human', 
        war: 3, sorcery: 3, scum: 4, defense: 3, economy: 5,
        multipliers: { economy: 1.1, military: 1.0, magic: 0.9 }
      },
      Elven: { 
        name: 'Elven', 
        war: 2, sorcery: 4, scum: 3, defense: 4, economy: 3,
        multipliers: { economy: 1.0, military: 0.95, magic: 1.1 }
      },
      Goblin: { 
        name: 'Goblin', 
        war: 4, sorcery: 2, scum: 2, defense: 3, economy: 3,
        multipliers: { economy: 0.9, military: 1.15, magic: 0.8 }
      },
      Droben: { 
        name: 'Droben', 
        war: 5, sorcery: 2, scum: 3, defense: 3, economy: 2,
        multipliers: { economy: 0.8, military: 1.25, magic: 0.7 }
      },
      Sidhe: { 
        name: 'Sidhe', 
        war: 2, sorcery: 5, scum: 4, defense: 3, economy: 3,
        multipliers: { economy: 0.9, military: 0.8, magic: 1.3 }
      },
      Elemental: { 
        name: 'Elemental', 
        war: 4, sorcery: 4, scum: 2, defense: 3, economy: 3,
        multipliers: { economy: 0.95, military: 1.1, magic: 1.2 }
      },
      Vampire: { 
        name: 'Vampire', 
        war: 3, sorcery: 4, scum: 4, defense: 4, economy: 2,
        multipliers: { economy: 0.7, military: 1.05, magic: 1.15 }
      },
      Fae: { 
        name: 'Fae', 
        war: 3, sorcery: 4, scum: 3, defense: 3, economy: 3,
        multipliers: { economy: 0.95, military: 0.95, magic: 1.1 }
      },
      Centaur: { 
        name: 'Centaur', 
        war: 2, sorcery: 2, scum: 5, defense: 2, economy: 2,
        multipliers: { economy: 0.8, military: 0.9, magic: 0.8 }
      },
      Dwarven: { 
        name: 'Dwarven', 
        war: 3, sorcery: 2, scum: 2, defense: 5, economy: 2,
        multipliers: { economy: 0.85, military: 1.0, magic: 0.7 }
      }
    },
    
    calculateCombatResult: (attacker: Record<string, unknown>, defender: Record<string, unknown>) => {
      const attackerRace = attacker.race || 'Human';
      const defenderRace = defender.race || 'Human';
      
      const attackerBonus = initializeGameMechanics().RACES[attackerRace]?.multipliers.military || 1.0;
      const defenderBonus = initializeGameMechanics().RACES[defenderRace]?.multipliers.military || 1.0;
      
      const attackerStr = (attacker.units?.warOffense || attacker.offense || 1000) * attackerBonus;
      const defenderStr = (defender.units?.defense || defender.defense || 1000) * defenderBonus;
      
      const success = attackerStr > defenderStr;
      const landGained = success ? Math.floor(defender.land * 0.1) : Math.floor(defender.land * 0.02);
      
      return {
        success,
        landGained,
        casualties: Math.floor(Math.random() * 50) + 10
      };
    },
    
    calculateLandGained: (attackerOffense: number, defenderDefense: number, targetLand: number) => {
      const ratio = attackerOffense / Math.max(defenderDefense, 1);
      if (ratio >= 2.0) return Math.floor(targetLand * 0.15); // With ease
      if (ratio >= 1.2) return Math.floor(targetLand * 0.08); // Good fight
      return Math.floor(targetLand * 0.02); // Failed attack
    },
    
    calculateBuildRate: (quarryPercentage: number) => {
      // BRT calculation from knowledge base
      if (quarryPercentage >= 95) return 30;
      if (quarryPercentage >= 90) return 29;
      if (quarryPercentage >= 85) return 28;
      if (quarryPercentage >= 80) return 27;
      if (quarryPercentage >= 75) return 26;
      if (quarryPercentage >= 70) return 25;
      if (quarryPercentage >= 65) return 24;
      if (quarryPercentage >= 60) return 23;
      if (quarryPercentage >= 55) return 22;
      if (quarryPercentage >= 50) return 21;
      if (quarryPercentage >= 45) return 20;
      if (quarryPercentage >= 40) return 19;
      if (quarryPercentage >= 35) return 18;
      if (quarryPercentage >= 30) return 16;
      if (quarryPercentage >= 25) return 14;
      if (quarryPercentage >= 20) return 12;
      if (quarryPercentage >= 15) return 10;
      if (quarryPercentage >= 10) return 8;
      if (quarryPercentage >= 5) return 6;
      return 4;
    },
    
    getRacialBonuses: (race: string) => {
      return initializeGameMechanics().RACES[race] || initializeGameMechanics().RACES.Human;
    }
  };
}
