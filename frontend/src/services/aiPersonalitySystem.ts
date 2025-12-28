/**
 * AI Personality System - Multi-Layered AI Opponents
 * Creates unique AI opponents with Race + Persona + Playstyle combinations
 */

export type AIPersonaType = 
  | 'warlord' | 'tactician' | 'berserker' | 'guardian'     // Military personas
  | 'merchant' | 'noble' | 'peasant' | 'diplomat'         // Social personas  
  | 'archmage' | 'trickster' | 'scholar' | 'cultist'      // Magic personas
  | 'assassin' | 'spy' | 'thief' | 'scout'                // Stealth personas
  | 'builder' | 'explorer' | 'survivor' | 'opportunist';  // Utility personas

export type AIPlaystyle = 
  | 'aggressive' | 'defensive' | 'balanced' | 'opportunistic'
  | 'calculated' | 'unpredictable' | 'patient' | 'reckless'
  | 'diplomatic' | 'isolationist' | 'expansionist' | 'turtle';

export interface AIPersonality {
  race: string;
  persona: AIPersonaType;
  playstyle: AIPlaystyle;
  name: string;
  title: string;
  description: string;
  
  // Core personality traits (0.0 - 2.0, 1.0 = neutral)
  traits: {
    aggression: number;      // How likely to attack
    economy: number;         // Economic focus
    magic: number;          // Magic usage
    diplomacy: number;      // Alliance/trade focus
    risk: number;           // Risk tolerance
    patience: number;       // Long-term vs short-term
    adaptability: number;   // Strategy flexibility
    loyalty: number;        // Alliance reliability
  };
  
  // Decision modifiers
  modifiers: {
    attackThreshold: number;     // Multiplier for attack decisions
    buildPriority: number;       // Economic building priority
    militaryFocus: number;       // Military unit training
    magicFocus: number;         // Magic/temple building
    defensiveFocus: number;     // Defensive structures
    allianceValue: number;      // How much they value alliances
    tradeFrequency: number;     // How often they trade
    warDeclarationCost: number; // Hesitation to declare war
  };
  
  // Behavioral patterns
  behavior: {
    preferredTargets: string[];      // Target selection preferences
    avoidedTargets: string[];        // Targets they avoid
    allianceStrategy: string;        // How they handle alliances
    economicStrategy: string;        // Economic approach
    militaryStrategy: string;        // Combat approach
    endgameStrategy: string;         // Late game focus
    quirks: string[];               // Unique behaviors
  };
}

/**
 * AI Personality Generator - Creates unique AI opponents
 */
export class AIPersonalitySystem {
  private personalities: Map<string, AIPersonality> = new Map();
  
  /**
   * Generate a unique AI personality for a kingdom
   */
  generatePersonality(kingdomId: string, race: string): AIPersonality {
    // Get race-specific persona pools
    const availablePersonas = this.getPersonasForRace(race);
    const availablePlaystyles = this.getPlaystylesForRace(race);
    
    // Select random persona and playstyle
    const persona = availablePersonas[Math.floor(Math.random() * availablePersonas.length)];
    const playstyle = availablePlaystyles[Math.floor(Math.random() * availablePlaystyles.length)];
    
    // Generate personality
    const personality = this.createPersonality(race, persona, playstyle);
    
    // Store for consistency
    this.personalities.set(kingdomId, personality);
    
    return personality;
  }
  
  /**
   * Get stored personality or generate new one
   */
  getPersonality(kingdomId: string, race: string): AIPersonality {
    if (this.personalities.has(kingdomId)) {
      return this.personalities.get(kingdomId)!;
    }
    return this.generatePersonality(kingdomId, race);
  }
  
  /**
   * Create personality with specific persona and playstyle (for testing)
   */
  createSpecificPersonality(kingdomId: string, race: string, persona: AIPersonaType, playstyle: AIPlaystyle): AIPersonality {
    const personality = this.createPersonality(race, persona, playstyle);
    this.personalities.set(kingdomId, personality);
    return personality;
  }
  
  /**
   * Create personality based on race + persona + playstyle
   */
  private createPersonality(race: string, persona: AIPersonaType, playstyle: AIPlaystyle): AIPersonality {
    // Base racial traits
    const raceTraits = this.getRaceBaseTraits(race);
    
    // Persona modifications
    const personaTraits = this.getPersonaTraits(persona);
    
    // Playstyle modifications  
    const playstyleTraits = this.getPlaystyleTraits(playstyle);
    
    // Combine traits (race base + persona + playstyle)
    const combinedTraits = this.combineTraits(raceTraits, personaTraits, playstyleTraits);
    
    // Generate modifiers from traits
    const modifiers = this.generateModifiers(combinedTraits);
    
    // Generate behavior patterns
    const behavior = this.generateBehavior(race, persona, playstyle, combinedTraits);
    
    // Generate name and description
    const { name, title, description } = this.generateIdentity(race, persona, playstyle);
    
    return {
      race,
      persona,
      playstyle,
      name,
      title,
      description,
      traits: combinedTraits,
      modifiers,
      behavior
    };
  }
  
  /**
   * Get available personas for each race
   */
  private getPersonasForRace(race: string): AIPersonaType[] {
    const racePersonas: Record<string, AIPersonaType[]> = {
      Human: ['merchant', 'noble', 'diplomat', 'builder', 'opportunist', 'explorer'],
      Droben: ['warlord', 'berserker', 'tactician', 'assassin', 'survivor'],
      Sidhe: ['archmage', 'trickster', 'scholar', 'cultist', 'spy'],
      Elven: ['guardian', 'diplomat', 'scholar', 'builder', 'survivor'],
      Goblin: ['berserker', 'warlord', 'thief', 'scout', 'opportunist'],
      Elemental: ['tactician', 'archmage', 'guardian', 'survivor', 'scholar'],
      Vampire: ['cultist', 'assassin', 'noble', 'trickster', 'spy'],
      Fae: ['trickster', 'diplomat', 'scholar', 'spy', 'opportunist'],
      Centaur: ['scout', 'spy', 'explorer', 'guardian', 'survivor'],
      Dwarven: ['guardian', 'builder', 'tactician', 'merchant', 'survivor']
    };
    
    return racePersonas[race] || racePersonas.Human;
  }
  
  /**
   * Get available playstyles for each race
   */
  private getPlaystylesForRace(race: string): AIPlaystyle[] {
    const racePlaystyles: Record<string, AIPlaystyle[]> = {
      Human: ['balanced', 'diplomatic', 'opportunistic', 'calculated', 'expansionist'],
      Droben: ['aggressive', 'reckless', 'calculated', 'expansionist'],
      Sidhe: ['patient', 'calculated', 'unpredictable', 'isolationist'],
      Elven: ['defensive', 'patient', 'diplomatic', 'turtle'],
      Goblin: ['aggressive', 'reckless', 'opportunistic', 'expansionist'],
      Elemental: ['balanced', 'calculated', 'patient', 'defensive'],
      Vampire: ['patient', 'calculated', 'isolationist', 'opportunistic'],
      Fae: ['unpredictable', 'opportunistic', 'diplomatic', 'balanced'],
      Centaur: ['patient', 'calculated', 'defensive', 'isolationist'],
      Dwarven: ['defensive', 'turtle', 'patient', 'calculated']
    };
    
    return racePlaystyles[race] || racePlaystyles.Human;
  }
  
  /**
   * Get base racial traits
   */
  private getRaceBaseTraits(race: string): AIPersonality['traits'] {
    const raceTraits: Record<string, AIPersonality['traits']> = {
      Human: { aggression: 1.0, economy: 1.3, magic: 0.8, diplomacy: 1.2, risk: 1.0, patience: 1.1, adaptability: 1.3, loyalty: 1.1 },
      Droben: { aggression: 1.6, economy: 0.7, magic: 0.6, diplomacy: 0.8, risk: 1.4, patience: 0.8, adaptability: 1.0, loyalty: 1.2 },
      Sidhe: { aggression: 0.8, economy: 0.9, magic: 1.7, diplomacy: 1.0, risk: 1.1, patience: 1.4, adaptability: 1.2, loyalty: 0.9 },
      Elven: { aggression: 0.7, economy: 1.0, magic: 1.2, diplomacy: 1.3, risk: 0.8, patience: 1.3, adaptability: 1.0, loyalty: 1.4 },
      Goblin: { aggression: 1.5, economy: 0.8, magic: 0.6, diplomacy: 0.7, risk: 1.5, patience: 0.7, adaptability: 1.1, loyalty: 0.8 },
      Elemental: { aggression: 1.2, economy: 1.0, magic: 1.3, diplomacy: 0.9, risk: 1.0, patience: 1.2, adaptability: 1.3, loyalty: 1.0 },
      Vampire: { aggression: 1.1, economy: 0.6, magic: 1.4, diplomacy: 0.8, risk: 1.3, patience: 1.5, adaptability: 1.1, loyalty: 0.7 },
      Fae: { aggression: 1.0, economy: 1.1, magic: 1.3, diplomacy: 1.1, risk: 1.2, patience: 1.0, adaptability: 1.4, loyalty: 1.0 },
      Centaur: { aggression: 0.8, economy: 0.9, magic: 0.7, diplomacy: 1.0, risk: 0.9, patience: 1.3, adaptability: 1.2, loyalty: 1.1 },
      Dwarven: { aggression: 0.9, economy: 1.1, magic: 0.6, diplomacy: 1.0, risk: 0.7, patience: 1.4, adaptability: 0.9, loyalty: 1.5 }
    };
    
    return raceTraits[race] || raceTraits.Human;
  }
  
  /**
   * Get persona trait modifications
   */
  private getPersonaTraits(persona: AIPersonaType): Partial<AIPersonality['traits']> {
    const personaTraits: Record<AIPersonaType, Partial<AIPersonality['traits']>> = {
      // Military personas
      warlord: { aggression: 1.4, risk: 1.2, patience: 0.8, loyalty: 1.3 },
      tactician: { aggression: 1.1, risk: 0.8, patience: 1.3, adaptability: 1.2 },
      berserker: { aggression: 1.8, risk: 1.6, patience: 0.5, adaptability: 0.7 },
      guardian: { aggression: 0.6, risk: 0.7, patience: 1.4, loyalty: 1.5 },
      
      // Social personas
      merchant: { economy: 1.4, diplomacy: 1.3, risk: 0.9, adaptability: 1.2 },
      noble: { diplomacy: 1.4, economy: 1.2, loyalty: 1.2, patience: 1.1 },
      peasant: { economy: 1.1, risk: 0.8, patience: 1.2, loyalty: 1.3 },
      diplomat: { diplomacy: 2.0, aggression: 0.4, patience: 1.5, adaptability: 1.2 },
      
      // Magic personas
      archmage: { magic: 1.6, patience: 1.4, risk: 0.9, adaptability: 1.1 },
      trickster: { magic: 1.3, risk: 1.4, adaptability: 1.5, loyalty: 0.8 },
      scholar: { magic: 1.2, patience: 1.5, risk: 0.7, adaptability: 1.1 },
      cultist: { magic: 1.4, risk: 1.3, loyalty: 0.6, patience: 1.2 },
      
      // Stealth personas
      assassin: { aggression: 1.3, risk: 1.2, patience: 1.2, loyalty: 0.8 },
      spy: { risk: 1.1, patience: 1.4, adaptability: 1.3, loyalty: 0.9 },
      thief: { risk: 1.3, adaptability: 1.2, loyalty: 0.7, economy: 1.1 },
      scout: { risk: 1.0, patience: 1.2, adaptability: 1.3, loyalty: 1.1 },
      
      // Utility personas
      builder: { economy: 1.3, patience: 1.4, risk: 0.8, loyalty: 1.2 },
      explorer: { risk: 1.2, adaptability: 1.4, patience: 0.9, loyalty: 1.0 },
      survivor: { risk: 0.6, patience: 1.3, adaptability: 1.2, loyalty: 1.1 },
      opportunist: { risk: 1.3, adaptability: 1.4, loyalty: 0.8, patience: 0.9 }
    };
    
    return personaTraits[persona];
  }
  
  /**
   * Get playstyle trait modifications
   */
  private getPlaystyleTraits(playstyle: AIPlaystyle): Partial<AIPersonality['traits']> {
    const playstyleTraits: Record<AIPlaystyle, Partial<AIPersonality['traits']>> = {
      aggressive: { aggression: 1.3, risk: 1.2, patience: 0.8 },
      defensive: { aggression: 0.7, risk: 0.8, patience: 1.3 },
      balanced: { adaptability: 1.2, loyalty: 1.1 },
      opportunistic: { risk: 1.2, adaptability: 1.3, loyalty: 0.9 },
      calculated: { risk: 0.8, patience: 1.3, adaptability: 1.1 },
      unpredictable: { risk: 1.4, adaptability: 1.4, loyalty: 0.8 },
      patient: { patience: 1.5, risk: 0.8, aggression: 0.8 },
      reckless: { risk: 1.6, patience: 0.6, aggression: 1.3 },
      diplomatic: { diplomacy: 1.4, aggression: 0.8, loyalty: 1.2 },
      isolationist: { diplomacy: 0.6, loyalty: 0.7, patience: 1.2 },
      expansionist: { aggression: 1.2, risk: 1.1, economy: 1.1 },
      turtle: { aggression: 0.6, risk: 0.7, patience: 1.4 }
    };
    
    return playstyleTraits[playstyle];
  }
  
  /**
   * Combine trait modifications
   */
  private combineTraits(
    base: AIPersonality['traits'], 
    persona: Partial<AIPersonality['traits']>, 
    playstyle: Partial<AIPersonality['traits']>
  ): AIPersonality['traits'] {
    const combined = { ...base };
    
    // Apply persona modifications
    Object.entries(persona).forEach(([key, value]) => {
      if (value !== undefined) {
        combined[key as keyof AIPersonality['traits']] *= value;
      }
    });
    
    // Apply playstyle modifications
    Object.entries(playstyle).forEach(([key, value]) => {
      if (value !== undefined) {
        combined[key as keyof AIPersonality['traits']] *= value;
      }
    });
    
    // Clamp values to reasonable ranges
    Object.keys(combined).forEach(key => {
      const traitKey = key as keyof AIPersonality['traits'];
      combined[traitKey] = Math.max(0.3, Math.min(2.5, combined[traitKey]));
    });
    
    return combined;
  }
  
  /**
   * Generate decision modifiers from traits
   */
  private generateModifiers(traits: AIPersonality['traits']): AIPersonality['modifiers'] {
    return {
      attackThreshold: 2.0 - traits.aggression,           // More aggressive = lower threshold
      buildPriority: traits.economy * 10,                 // Economic focus
      militaryFocus: traits.aggression * 10,              // Military focus
      magicFocus: traits.magic * 10,                      // Magic focus
      defensiveFocus: (2.0 - traits.risk) * 10,          // Risk averse = more defensive
      allianceValue: traits.diplomacy * 10,               // Diplomatic value
      tradeFrequency: traits.diplomacy * traits.economy,  // Trade activity
      warDeclarationCost: (2.0 - traits.aggression) * traits.patience // War hesitation
    };
  }
  
  /**
   * Generate behavior patterns
   */
  private generateBehavior(
    race: string, 
    persona: AIPersonaType, 
    playstyle: AIPlaystyle, 
    traits: AIPersonality['traits']
  ): AIPersonality['behavior'] {
    // This would be a complex system - simplified for now
    return {
      preferredTargets: this.getPreferredTargets(persona, playstyle),
      avoidedTargets: this.getAvoidedTargets(persona, playstyle),
      allianceStrategy: this.getAllianceStrategy(traits.diplomacy, traits.loyalty),
      economicStrategy: this.getEconomicStrategy(traits.economy, traits.risk),
      militaryStrategy: this.getMilitaryStrategy(traits.aggression, traits.patience),
      endgameStrategy: this.getEndgameStrategy(race, persona, playstyle),
      quirks: this.getPersonalityQuirks(race, persona, playstyle)
    };
  }
  
  /**
   * Generate identity (name, title, description)
   */
  private generateIdentity(race: string, persona: AIPersonaType, playstyle: AIPlaystyle): {
    name: string;
    title: string;
    description: string;
  } {
    const names = this.getNamePool(race);
    const titles = this.getTitlePool(race, persona);
    
    const name = names[Math.floor(Math.random() * names.length)];
    const title = titles[Math.floor(Math.random() * titles.length)];
    const description = `A ${playstyle} ${race} ${persona} known for ${this.getPersonalityDescription(persona, playstyle)}`;
    
    return { name, title, description };
  }
  
  // Helper methods for behavior generation (simplified)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private getPreferredTargets(persona: AIPersonaType, _playstyle: AIPlaystyle): string[] {
    if (persona === 'berserker') return ['weak', 'isolated'];
    if (persona === 'opportunist') return ['distracted', 'weakened'];
    if (persona === 'tactician') return ['strategic', 'valuable'];
    return ['suitable'];
  }
  
  private getAvoidedTargets(persona: AIPersonaType, playstyle: AIPlaystyle): string[] {
    if (playstyle === 'defensive') return ['strong', 'allied'];
    if (persona === 'diplomat') return ['allied', 'friendly'];
    return ['overwhelming'];
  }
  
  private getAllianceStrategy(diplomacy: number, loyalty: number): string {
    if (diplomacy > 1.3 && loyalty > 1.2) return 'loyal_ally';
    if (diplomacy > 1.2) return 'active_diplomat';
    if (loyalty < 0.8) return 'opportunistic_betrayer';
    return 'neutral';
  }
  
  private getEconomicStrategy(economy: number, risk: number): string {
    if (economy > 1.3 && risk < 0.9) return 'conservative_growth';
    if (economy > 1.2) return 'economic_focus';
    if (risk > 1.3) return 'high_risk_high_reward';
    return 'balanced_economy';
  }
  
  private getMilitaryStrategy(aggression: number, patience: number): string {
    if (aggression > 1.4 && patience < 0.8) return 'blitz_warfare';
    if (aggression > 1.2) return 'aggressive_expansion';
    if (patience > 1.3) return 'calculated_strikes';
    return 'defensive_military';
  }
  
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private getEndgameStrategy(race: string, persona: AIPersonaType, _playstyle: AIPlaystyle): string {
    if (persona === 'warlord') return 'military_domination';
    if (persona === 'merchant') return 'economic_victory';
    if (persona === 'archmage') return 'magical_supremacy';
    return 'balanced_victory';
  }
  
  private getPersonalityQuirks(race: string, persona: AIPersonaType, playstyle: AIPlaystyle): string[] {
    // Unique behavioral quirks based on personality combination
    const quirks: string[] = [];
    
    if (race === 'Droben' && persona === 'berserker') {
      quirks.push('attacks_when_wounded', 'ignores_weak_targets');
    }
    
    if (persona === 'trickster') {
      quirks.push('unpredictable_alliances', 'surprise_attacks');
    }
    
    if (playstyle === 'turtle' && persona === 'guardian') {
      quirks.push('extreme_defensive', 'alliance_protector');
    }
    
    return quirks;
  }
  
  private getNamePool(race: string): string[] {
    const namePool: Record<string, string[]> = {
      Human: ['Marcus', 'Elena', 'Thomas', 'Isabella', 'William', 'Catherine'],
      Droben: ['Grimjaw', 'Bloodfang', 'Ironhide', 'Skullcrusher', 'Darkbane'],
      Sidhe: ['Silvermoon', 'Starweaver', 'Moonwhisper', 'Dawnbringer', 'Nightfall'],
      Elven: ['Aelindra', 'Thalorin', 'Silvanus', 'Elenion', 'Galadwen'],
      Goblin: ['Snaggletooth', 'Rustblade', 'Quickstab', 'Grimbolt', 'Sneakfang'],
      // ... more names for other races
    };
    
    return namePool[race] || namePool.Human;
  }
  
  private getTitlePool(race: string, persona: AIPersonaType): string[] {
    const baseTitles = {
      warlord: ['the Conqueror', 'the Destroyer', 'the Warlord'],
      merchant: ['the Wealthy', 'the Trader', 'the Merchant Prince'],
      archmage: ['the Wise', 'the Arcane', 'the Spellweaver'],
      // ... more titles
    };
    
    return baseTitles[persona] || ['the Bold'];
  }
  
  private getPersonalityDescription(persona: AIPersonaType, playstyle: AIPlaystyle): string {
    return `${persona} tactics and ${playstyle} approach`;
  }
}
