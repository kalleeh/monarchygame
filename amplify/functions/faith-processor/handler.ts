import type { Schema } from '../../data/resource';
import { generateClient } from 'aws-amplify/data';
import { ErrorCode } from '../../../shared/types/kingdom';
import { log } from '../logger';
import { configureAmplify } from '../amplify-configure';

configureAmplify();
const client = generateClient<Schema>({ authMode: 'iam' });

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

      const result = await client.models.Kingdom.get({ id: kingdomId });
      if (!result.data) {
        return { success: false, error: 'Kingdom not found', errorCode: ErrorCode.NOT_FOUND };
      }

      // Verify kingdom ownership
      const ownerField = (result.data as any).owner as string | null;
      if (!ownerField || (!ownerField.includes(identity.sub) && !ownerField.includes(identity.username ?? ''))) {
        return { success: false, error: 'You do not own this kingdom', errorCode: ErrorCode.FORBIDDEN };
      }

      const kingdomRace = result.data.race as string;

      // Validate race compatibility (neutral allows all)
      if (alignment !== 'neutral') {
        const allowedRaces = ALIGNMENT_COMPATIBLE_RACES[alignment];
        if (!allowedRaces.includes(kingdomRace)) {
          return { success: false, error: `Race '${kingdomRace}' is not compatible with alignment '${alignment}'`, errorCode: ErrorCode.VALIDATION_FAILED };
        }
      }

      const stats = (result.data.stats ?? {}) as Record<string, unknown>;
      const updatedStats = { ...stats, faithAlignment: alignment };

      await client.models.Kingdom.update({
        id: kingdomId,
        stats: updatedStats,
      });

      log.info('faith-processor', 'selectAlignment', { kingdomId, alignment });
      return { success: true, result: JSON.stringify({ alignment }) };

    } else if (action === 'useFocusAbility') {
      if (!abilityType || !(VALID_ABILITY_TYPES as readonly string[]).includes(abilityType)) {
        return { success: false, error: `Invalid abilityType. Must be one of: ${VALID_ABILITY_TYPES.join(', ')}`, errorCode: ErrorCode.INVALID_PARAM };
      }

      const result = await client.models.Kingdom.get({ id: kingdomId });
      if (!result.data) {
        return { success: false, error: 'Kingdom not found', errorCode: ErrorCode.NOT_FOUND };
      }

      // Verify kingdom ownership
      const ownerField = (result.data as any).owner as string | null;
      if (!ownerField || (!ownerField.includes(identity.sub) && !ownerField.includes(identity.username ?? ''))) {
        return { success: false, error: 'You do not own this kingdom', errorCode: ErrorCode.FORBIDDEN };
      }

      const stats = (result.data.stats ?? {}) as Record<string, unknown>;
      const focusPoints = (stats.focusPoints as number) ?? 0;
      const cost = ABILITY_COSTS[abilityType];

      if (focusPoints < cost) {
        return { success: false, error: `Insufficient focus points: need ${cost}, have ${focusPoints}`, errorCode: ErrorCode.INSUFFICIENT_RESOURCES };
      }

      const remainingFocusPoints = focusPoints - cost;
      const updatedStats = { ...stats, focusPoints: remainingFocusPoints };

      await client.models.Kingdom.update({
        id: kingdomId,
        stats: updatedStats,
      });

      log.info('faith-processor', 'useFocusAbility', { kingdomId, abilityType });
      return { success: true, result: JSON.stringify({ abilityType, cost, remainingFocusPoints }) };

    } else {
      return { success: false, error: `Invalid action. Must be 'selectAlignment' or 'useFocusAbility'`, errorCode: ErrorCode.INVALID_PARAM };
    }
  } catch (error) {
    log.error('faith-processor', error, { kingdomId, action });
    return { success: false, error: 'Faith operation failed', errorCode: ErrorCode.INTERNAL_ERROR };
  }
};
