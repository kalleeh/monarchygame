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
  // Live status fields (from server getSpellStatus / demo store) so the client
  // computes maxElan and temple gates from real data.
  templeCount?: number;
  landCount?: number;
  raceId?: string;
  maxElan?: number;
  templePercentage?: number;
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
    targetId?: string
  ): Promise<SpellCastResponse> {
    try {
      const response = await AmplifyFunctionService.castSpell({
        kingdomId,
        action: 'cast',
        spellId: spellId,
        targetId: targetId || undefined
      });

      const r = (response ?? {}) as Record<string, unknown>;
      return {
        success: Boolean(r.success),
        message: (typeof r.message === 'string' && r.message) ? r.message : '',
        newMana: Number(r.newMana) || 0,
        newElan: Number(r.newElan) || 0,
        effects: Array.isArray(r.effects) ? r.effects as string[] : []
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
    _spellId: string
  ): Promise<SpellValidationResponse> {
    try {
      const response = await AmplifyFunctionService.callFunction('spell-processor', {
        action: 'validate',
        kingdomId
      });

      const r = response as Record<string, unknown>;
      return {
        canCast: Boolean(r.canCast) || false,
        reason: String(r.reason || ''),
        requiredMana: Number(r.requiredMana) || 0,
        currentElan: Number(r.currentElan) || 0,
        templeCount: r.templeCount != null ? Number(r.templeCount) : undefined,
        landCount: r.landCount != null ? Number(r.landCount) : undefined,
        raceId: r.raceId != null ? String(r.raceId) : undefined,
        maxElan: r.maxElan != null ? Number(r.maxElan) : undefined,
        templePercentage: r.templePercentage != null ? Number(r.templePercentage) : undefined,
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
