import { AmplifyFunctionService } from './amplifyFunctionService';

export interface SpellData {
  id: string;
  name: string;
  description: string;
  manaCost: number;
  elanCost: number;
  power: number;
  range: number;
  duration: number;
  cooldown: number;
  requirements: string[];
  effects: string[];
}

export interface SpellCastResponse {
  success: boolean;
  message: string;
  newMana: number;
  newElan: number;
  effects: string[];
}

export interface SpellValidationResponse {
  canCast: boolean;
  reason?: string;
  requiredMana: number;
  currentElan: number;
}

export class SpellService {
  /**
   * Get available spells for a kingdom
   */
  static async getAvailableSpells(kingdomId: string): Promise<{
    spells: SpellData[];
    mana: number;
    elan: number;
    cost: number;
    power: number;
    range: number;
  }> {
    try {
      const response = await AmplifyFunctionService.callFunction('spell-processor', {
        action: 'get_spells',
        kingdomId
      }) as Record<string, unknown>;
      
      return {
        spells: Array.isArray(response.spells) ? response.spells : [],
        mana: Number(response.mana) || 0,
        elan: Number(response.elan) || 0,
        cost: Number(response.cost) || 0,
        power: Number(response.power) || 0,
        range: Number(response.range) || 0
      };
    } catch (error) {
      console.error('Failed to get available spells:', error);
      return {
        spells: [],
        mana: 0,
        elan: 0,
        cost: 0,
        power: 0,
        range: 0
      };
    }
  }

  /**
   * Cast a spell
   */
  static async castSpell(
    kingdomId: string,
    spellId: string,
    // @ts-expect-error unused parameter  
    targetId?: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _repeatCount: number = 1
  ): Promise<SpellCastResponse> {
    try {
      const response = await AmplifyFunctionService.castSpell({
        kingdomId,
        action: 'cast_spell',
        spellId: spellId
      });

      return {
        success: Boolean((response as Record<string, unknown>).success) || false,
        message: String((response as Record<string, unknown>).message) || '',
        newMana: Number((response as Record<string, unknown>).newMana) || 0,
        newElan: Number((response as Record<string, unknown>).newElan) || 0,
        effects: Array.isArray((response as Record<string, unknown>).effects) ? (response as Record<string, unknown>).effects as string[] : []
      };
    } catch (error) {
      console.error('Failed to cast spell:', error);
      return {
        success: false,
        message: 'Failed to cast spell',
        newMana: 0,
        newElan: 0,
        effects: []
      };
    }
  }

  /**
   * Validate if a spell can be cast
   */
  static async validateSpell(
    kingdomId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _spellId: string
  ): Promise<SpellValidationResponse> {
    try {
      const response = await AmplifyFunctionService.callFunction('spell-processor', {
        action: 'validate',
        kingdomId
      });

      return {
        canCast: Boolean((response as Record<string, unknown>).canCast) || false,
        reason: String((response as Record<string, unknown>).reason || ''),
        requiredMana: Number((response as Record<string, unknown>).requiredMana) || 0,
        currentElan: Number((response as Record<string, unknown>).currentElan) || 0
      };
    } catch (error) {
      console.error('Failed to validate spell:', error);
      return {
        canCast: false,
        reason: 'Validation failed',
        requiredMana: 0,
        currentElan: 0
      };
    }
  }

  /**
   * Get spell history for analytics
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  static async getSpellHistory(kingdomId: string, _limit: number = 50) {
    try {
      const response = await AmplifyFunctionService.callFunction('spell-processor', {
        action: 'history',
        kingdomId
      });

      return Array.isArray((response as Record<string, unknown>).history) ? (response as Record<string, unknown>).history as unknown[] : [];
    } catch (error) {
      console.error('Failed to get spell history:', error);
      return [];
    }
  }
}
