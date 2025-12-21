/**
 * AI Personality Dialogue System
 * Generates personality-based diplomatic interactions and messages
 */

import type { AIPersonality } from './aiPersonalitySystem';

export interface DialogueContext {
  situation: 'alliance_offer' | 'trade_request' | 'war_declaration' | 'peace_offer' | 'taunt' | 'victory' | 'defeat';
  relationship: 'friendly' | 'neutral' | 'hostile' | 'allied';
  playerStrength: 'stronger' | 'equal' | 'weaker';
  gamePhase: 'early' | 'mid' | 'late';
}

export interface DialogueResponse {
  message: string;
  tone: 'aggressive' | 'diplomatic' | 'arrogant' | 'respectful' | 'fearful' | 'cunning' | 'neutral';
  likelihood: number; // 0-1 probability of this response
}

/**
 * Generates personality-driven dialogue for AI opponents
 */
export class AIDialogueSystem {
  
  /**
   * Generate dialogue response based on personality and context
   */
  generateDialogue(
    personality: AIPersonality,
    context: DialogueContext
  ): DialogueResponse {
    const responses = this.getResponsePool(personality, context);
    const selectedResponse = this.selectResponse(responses, personality, context);
    
    return {
      ...selectedResponse,
      message: this.personalizeMessage(selectedResponse.message, personality)
    };
  }

  /**
   * Get pool of possible responses for situation
   */
  private getResponsePool(
    personality: AIPersonality,
    context: DialogueContext
  ): DialogueResponse[] {
    const responses: DialogueResponse[] = [];
    
    switch (context.situation) {
      case 'alliance_offer':
        responses.push(...this.getAllianceResponses(personality, context));
        break;
      case 'trade_request':
        responses.push(...this.getTradeResponses(personality, context));
        break;
      case 'war_declaration':
        responses.push(...this.getWarResponses(personality, context));
        break;
      case 'peace_offer':
        responses.push(...this.getPeaceResponses(personality, context));
        break;
      case 'taunt':
        responses.push(...this.getTauntResponses(personality, context));
        break;
      case 'victory':
        responses.push(...this.getVictoryResponses(personality, context));
        break;
      case 'defeat':
        responses.push(...this.getDefeatResponses(personality, context));
        break;
    }
    
    return responses;
  }

  /**
   * Alliance offer responses based on personality
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private getAllianceResponses(personality: AIPersonality, _context: DialogueContext): DialogueResponse[] {
    const responses: DialogueResponse[] = [];
    
    // Diplomatic personalities
    if (personality.traits.diplomacy > 1.2) {
      responses.push({
        message: "Your proposal intrigues me. Let us forge a bond that benefits both our realms.",
        tone: 'diplomatic',
        likelihood: 0.8
      });
    }
    
    // Aggressive personalities
    if (personality.traits.aggression > 1.4) {
      responses.push({
        message: "Alliances are for the weak. Prove your worth in battle first!",
        tone: 'aggressive',
        likelihood: 0.7
      });
    }
    
    // Opportunistic personalities
    if (personality.persona === 'opportunist') {
      responses.push({
        message: "An alliance? Perhaps... if the terms favor my interests sufficiently.",
        tone: 'cunning',
        likelihood: 0.6
      });
    }
    
    // Loyal personalities
    if (personality.traits.loyalty > 1.3) {
      responses.push({
        message: "I value lasting partnerships. You have my word and my sword.",
        tone: 'respectful',
        likelihood: 0.9
      });
    }
    
    return responses;
  }

  /**
   * Trade request responses
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private getTradeResponses(personality: AIPersonality, _context: DialogueContext): DialogueResponse[] {
    const responses: DialogueResponse[] = [];
    
    // Economic personalities
    if (personality.traits.economy > 1.2) {
      responses.push({
        message: "Trade is the lifeblood of prosperity. Let us discuss terms.",
        tone: 'diplomatic',
        likelihood: 0.8
      });
    }
    
    // Isolationist personalities
    if (personality.playstyle === 'isolationist') {
      responses.push({
        message: "My realm is self-sufficient. We have no need for outside commerce.",
        tone: 'arrogant',
        likelihood: 0.7
      });
    }
    
    return responses;
  }

  /**
   * War declaration responses
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private getWarResponses(personality: AIPersonality, _context: DialogueContext): DialogueResponse[] {
    const responses: DialogueResponse[] = [];
    
    // Berserker personalities
    if (personality.persona === 'berserker') {
      responses.push({
        message: "FINALLY! My axes thirst for blood! Come and face your doom!",
        tone: 'aggressive',
        likelihood: 0.9
      });
    }
    
    // Tactician personalities
    if (personality.persona === 'tactician') {
      responses.push({
        message: "You have made a calculated error. I shall demonstrate the cost of poor strategy.",
        tone: 'arrogant',
        likelihood: 0.8
      });
    }
    
    // Diplomatic personalities (try to avoid war)
    if (personality.traits.diplomacy > 1.5) {
      responses.push({
        message: "Wait! Surely we can resolve this through negotiation? War benefits no one.",
        tone: 'diplomatic',
        likelihood: 0.8
      });
    }
    
    // Fearful responses (weak vs strong)
    if (context.playerStrength === 'stronger' && personality.traits.risk < 0.8) {
      responses.push({
        message: "Wait! Surely we can resolve this through negotiation?",
        tone: 'fearful',
        likelihood: 0.7
      });
    }
    
    // General aggressive response for high aggression personalities
    if (personality.traits.aggression > 1.5) {
      responses.push({
        message: "Your realm will fall before my might! Prepare for war!",
        tone: 'aggressive',
        likelihood: 0.8
      });
    }
    
    // Default war response
    if (responses.length === 0) {
      responses.push({
        message: "So be it. We shall settle this through force of arms.",
        tone: 'respectful',
        likelihood: 0.6
      });
    }
    
    return responses;
  }

  /**
   * Peace offer responses
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private getPeaceResponses(personality: AIPersonality, _context: DialogueContext): DialogueResponse[] {
    const responses: DialogueResponse[] = [];
    
    // Diplomatic personalities (high priority)
    if (personality.traits.diplomacy > 1.2) {
      responses.push({
        message: "Wisdom prevails over warfare. I accept your offer of peace.",
        tone: 'diplomatic',
        likelihood: 0.9
      });
    }
    
    // Stubborn personalities
    if (personality.traits.patience > 1.4 && personality.traits.aggression > 1.2) {
      responses.push({
        message: "Peace? Only after you've paid for your transgressions in full.",
        tone: 'aggressive',
        likelihood: 0.6
      });
    }
    
    // Default diplomatic response for moderate diplomacy
    if (personality.traits.diplomacy > 1.0 && responses.length === 0) {
      responses.push({
        message: "Perhaps it is time to end this conflict. I am willing to discuss terms.",
        tone: 'diplomatic',
        likelihood: 0.7
      });
    }
    
    // Default response
    if (responses.length === 0) {
      responses.push({
        message: "Very well. Let us speak of peace.",
        tone: 'respectful',
        likelihood: 0.6
      });
    }
    
    return responses;
  }

  /**
   * Taunt responses
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private getTauntResponses(personality: AIPersonality, _context: DialogueContext): DialogueResponse[] {
    const responses: DialogueResponse[] = [];
    
    // Race-specific taunts
    switch (personality.race) {
      case 'Droben':
        responses.push({
          message: "Your pathetic realm will burn beneath Droben steel!",
          tone: 'aggressive',
          likelihood: 0.8
        });
        break;
      case 'Sidhe':
        responses.push({
          message: "Your crude tactics are no match for ancient Sidhe wisdom.",
          tone: 'arrogant',
          likelihood: 0.7
        });
        break;
      case 'Human':
        responses.push({
          message: "Human ingenuity will triumph over your primitive ways.",
          tone: 'arrogant',
          likelihood: 0.6
        });
        break;
    }
    
    return responses;
  }

  /**
   * Victory responses
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private getVictoryResponses(personality: AIPersonality, _context: DialogueContext): DialogueResponse[] {
    const responses: DialogueResponse[] = [];
    
    // Arrogant victory
    if (personality.traits.aggression > 1.3) {
      responses.push({
        message: "Did you truly believe you could challenge my might? Pathetic!",
        tone: 'arrogant',
        likelihood: 0.8
      });
    }
    
    // Respectful victory
    if (personality.traits.diplomacy > 1.2) {
      responses.push({
        message: "You fought with honor. Perhaps we can find common ground in the future.",
        tone: 'respectful',
        likelihood: 0.7
      });
    }
    
    return responses;
  }

  /**
   * Defeat responses
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private getDefeatResponses(personality: AIPersonality, _context: DialogueContext): DialogueResponse[] {
    const responses: DialogueResponse[] = [];
    
    // Defiant defeat
    if (personality.traits.aggression > 1.2) {
      responses.push({
        message: "This is not over! I will have my revenge!",
        tone: 'aggressive',
        likelihood: 0.7
      });
    }
    
    // Graceful defeat
    if (personality.traits.diplomacy > 1.2) {
      responses.push({
        message: "Well fought. You have earned this victory through skill and strategy.",
        tone: 'respectful',
        likelihood: 0.8
      });
    }
    
    return responses;
  }

  /**
   * Select most appropriate response based on personality
   */
  private selectResponse(
    responses: DialogueResponse[],
    personality: AIPersonality,
    context: DialogueContext
  ): DialogueResponse {
    if (responses.length === 0) {
      return {
        message: "...",
        tone: 'neutral',
        likelihood: 1.0
      };
    }
    
    // Weight responses by personality traits
    const weightedResponses = responses.map(response => ({
      ...response,
      weight: this.calculateResponseWeight(response, personality, context)
    }));
    
    // Select highest weighted response
    return weightedResponses.reduce((best, current) => 
      current.weight > best.weight ? current : best
    );
  }

  /**
   * Calculate response weight based on personality fit
   */
  private calculateResponseWeight(
    response: DialogueResponse,
    personality: AIPersonality,
    _context: DialogueContext
  ): number {
    void _context; // Explicitly mark as intentionally unused
    let weight = response.likelihood;
    
    // Adjust weight based on personality-tone match
    switch (response.tone) {
      case 'aggressive':
        weight *= personality.traits.aggression;
        break;
      case 'diplomatic':
        weight *= personality.traits.diplomacy;
        break;
      case 'arrogant':
        weight *= (2.0 - personality.traits.diplomacy) * personality.traits.aggression;
        break;
      case 'respectful':
        weight *= personality.traits.diplomacy * personality.traits.loyalty;
        break;
      case 'fearful':
        weight *= (2.0 - personality.traits.aggression) * (2.0 - personality.traits.risk);
        break;
      case 'cunning':
        weight *= personality.traits.adaptability * (2.0 - personality.traits.loyalty);
        break;
      case 'neutral':
        // Neutral responses are not personality-weighted
        break;
    }
    
    return weight;
  }

  /**
   * Personalize message with character-specific elements
   */
  private personalizeMessage(message: string, personality: AIPersonality): string {
    // Add personality-specific prefixes/suffixes
    let personalizedMessage = message;
    
    // Add character name and title
    if (Math.random() < 0.3) {
      personalizedMessage = `${personalizedMessage} - ${personality.name} ${personality.title}`;
    }
    
    // Add race-specific flavor
    if (personality.race === 'Droben' && personality.persona === 'berserker') {
      personalizedMessage = personalizedMessage.toUpperCase();
    }
    
    if (personality.race === 'Sidhe' && personality.persona === 'archmage') {
      personalizedMessage = `*Ancient wisdom speaks* ${personalizedMessage}`;
    }
    
    if (personality.race === 'Goblin' && personality.persona === 'thief') {
      personalizedMessage = personalizedMessage.replace(/\./g, '... hehe...');
    }
    
    return personalizedMessage;
  }

  /**
   * Generate contextual diplomatic message
   */
  generateDiplomaticMessage(
    fromPersonality: AIPersonality,
    toPersonality: AIPersonality,
    situation: DialogueContext['situation']
  ): string {
    const context: DialogueContext = {
      situation,
      relationship: 'neutral',
      playerStrength: 'equal',
      gamePhase: 'mid'
    };
    
    const dialogue = this.generateDialogue(fromPersonality, context);
    return `${fromPersonality.name} ${fromPersonality.title} says: "${dialogue.message}"`;
  }
}
