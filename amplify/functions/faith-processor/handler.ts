import type { Schema } from '../../data/resource';
import { ErrorCode } from '../../../shared/types/kingdom';
import { log } from '../logger';
import { dbGet, dbUpdate, dbList, dbAtomicAdd, parseJsonField } from '../data-client';

const VALID_ALIGNMENTS = ['angelique', 'neutral', 'elemental'] as const;
const VALID_ABILITY_TYPES = ['racial_ability', 'spell_power', 'combat_focus', 'economic_focus', 'emergency'] as const;

const ALIGNMENT_COMPATIBLE_RACES: Record<string, string[]> = {
  angelique: ['Vampire', 'Human', 'Elven', 'Fae'],
  elemental: ['Elemental', 'Elven', 'Centaur'],
  neutral: [], // empty means all races allowed
};

const ABILITY_COSTS: Record<string, number> = {
  racial_ability: 10,
  spell_power: 15,
  combat_focus: 8,
  economic_focus: 6,
  emergency: 20,
};

type KingdomType = {
  id: string;
  owner?: string | null;
  race?: string | null;
  stats?: Record<string, unknown> | null;
};

export const handler: Schema["updateFaith"]["functionHandler"] = async (event) => {
  const { kingdomId, action, alignment, abilityType } = event.arguments;

  try {
    if (!kingdomId || !action) {
      return { success: false, error: 'Missing required parameters: kingdomId, action', errorCode: ErrorCode.MISSING_PARAMS };
    }

    // Verify caller identity
    const identity = event.identity as { sub?: string; username?: string } | null;
    if (!identity?.sub) {
      return { success: false, error: 'Authentication required', errorCode: ErrorCode.UNAUTHORIZED };
    }

    if (action === 'selectAlignment') {
      if (!alignment || !(VALID_ALIGNMENTS as readonly string[]).includes(alignment)) {
        return { success: false, error: `Invalid alignment. Must be one of: ${VALID_ALIGNMENTS.join(', ')}`, errorCode: ErrorCode.INVALID_PARAM };
      }

      const kingdom = await dbGet<KingdomType>('Kingdom', kingdomId);
      if (!kingdom) {
        return { success: false, error: 'Kingdom not found', errorCode: ErrorCode.NOT_FOUND };
      }

      // Verify kingdom ownership
      const ownerField = kingdom.owner ?? null;
      const _oids = [identity.sub ?? '', (identity as any).username ?? '',
        (identity as any).claims?.email ?? '', (identity as any).claims?.['preferred_username'] ?? '',
        (identity as any).claims?.['cognito:username'] ?? ''].filter(Boolean);
      if (!ownerField || !_oids.some(id => ownerField.includes(id))) {
        return { success: false, error: 'You do not own this kingdom', errorCode: ErrorCode.FORBIDDEN };
      }

      const kingdomRace = kingdom.race as string;

      // Validate race compatibility (neutral allows all)
      if (alignment !== 'neutral') {
        const allowedRaces = ALIGNMENT_COMPATIBLE_RACES[alignment];
        if (!allowedRaces.includes(kingdomRace)) {
          return { success: false, error: `Race '${kingdomRace}' is not compatible with alignment '${alignment}'`, errorCode: ErrorCode.VALIDATION_FAILED };
        }
      }

      const stats = parseJsonField<Record<string, unknown>>(kingdom.stats, {});
      const updatedStats = { ...stats, faithAlignment: alignment };

      await dbUpdate('Kingdom', kingdomId, {
        stats: updatedStats,
      });

      log.info('faith-processor', 'selectAlignment', { kingdomId, alignment });
      return { success: true, result: JSON.stringify({ alignment }) };

    } else if (action === 'useFocusAbility') {
      if (!abilityType || !(VALID_ABILITY_TYPES as readonly string[]).includes(abilityType)) {
        return { success: false, error: `Invalid abilityType. Must be one of: ${VALID_ABILITY_TYPES.join(', ')}`, errorCode: ErrorCode.INVALID_PARAM };
      }

      const kingdom = await dbGet<KingdomType>('Kingdom', kingdomId);
      if (!kingdom) {
        return { success: false, error: 'Kingdom not found', errorCode: ErrorCode.NOT_FOUND };
      }

      // Verify kingdom ownership
      const ownerField = kingdom.owner ?? null;
      const _oids = [identity.sub ?? '', (identity as any).username ?? '',
        (identity as any).claims?.email ?? '', (identity as any).claims?.['preferred_username'] ?? '',
        (identity as any).claims?.['cognito:username'] ?? ''].filter(Boolean);
      if (!ownerField || !_oids.some(id => ownerField.includes(id))) {
        return { success: false, error: 'You do not own this kingdom', errorCode: ErrorCode.FORBIDDEN };
      }

      // Check restoration status
      const allRestoration = await dbList<{ kingdomId: string; endTime: string; prohibitedActions?: string }>('RestorationStatus');
      const activeRestoration = allRestoration.find(r => r.kingdomId === kingdomId && new Date(r.endTime) > new Date());
      if (activeRestoration) {
        const prohibited: string[] = typeof activeRestoration.prohibitedActions === 'string'
          ? JSON.parse(activeRestoration.prohibitedActions)
          : (activeRestoration.prohibitedActions ?? []);
        if (prohibited.some(a => ['build', 'train', 'espionage', 'attack', 'trade'].includes(a))) {
          return { success: false, error: 'Kingdom is in restoration and cannot perform this action', errorCode: ErrorCode.RESTORATION_BLOCKED };
        }
      }

      // BL-2: Use parseJsonField; BL-5: spread existing stats to preserve all fields including activeFaithEffects
      const stats = parseJsonField<Record<string, unknown>>(kingdom.stats, {});
      const focusPoints = (stats.focusPoints as number) ?? 0;
      const cost = ABILITY_COSTS[abilityType];

      if (focusPoints < cost) {
        return { success: false, error: `Insufficient focus points: need ${cost}, have ${focusPoints}`, errorCode: ErrorCode.INSUFFICIENT_RESOURCES };
      }

      const remainingFocusPoints = focusPoints - cost;

      // Spread existing stats first so all fields (including activeFaithEffects) are preserved
      let updatedStats: Record<string, unknown> = { ...stats, focusPoints: remainingFocusPoints };
      if (['combat_focus', 'economic_focus', 'spell_power', 'racial_ability'].includes(abilityType)) {
        const now = new Date().toISOString();
        const existingEffects = (stats.activeFaithEffects as Array<Record<string, string>>) ?? [];
        const activeEffects = existingEffects.filter(e => e.expiresAt > now);
        const effectTypeMap: Record<string, string> = {
          combat_focus: 'COMBAT_FOCUS',
          economic_focus: 'ECONOMIC_FOCUS',
          spell_power: 'SPELL_POWER_BOOST',
          racial_ability: 'RACIAL_ABILITY_BOOST',
        };
        const effectType = effectTypeMap[abilityType];
        const newEffect = {
          effectType,
          appliedAt: now,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        };
        updatedStats = { ...updatedStats, activeFaithEffects: [...activeEffects, newEffect] };
      } else if (abilityType === 'emergency') {
        // EMERGENCY_ACTION: immediate +5 turns — no persistent effect stored
        await dbAtomicAdd('Kingdom', kingdomId, 'turnsBalance', 5);
        log.info('faith-processor', 'emergency-action', { kingdomId, turnsGranted: 5 });
      }

      await dbUpdate('Kingdom', kingdomId, {
        stats: updatedStats,
      });

      log.info('faith-processor', 'useFocusAbility', { kingdomId, abilityType });
      return { success: true, result: JSON.stringify({ abilityType, cost, remainingFocusPoints }) };

    } else {
      return { success: false, error: `Invalid action. Must be 'selectAlignment' or 'useFocusAbility'`, errorCode: ErrorCode.INVALID_PARAM };
    }
  } catch (error) {
    log.error('faith-processor', error, { kingdomId, action });
    return { success: false, error: error instanceof Error ? error.message : 'Faith operation failed', errorCode: ErrorCode.INTERNAL_ERROR };
  }
};
