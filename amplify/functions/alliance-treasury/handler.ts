import type { Schema } from '../../data/resource';
import type { KingdomResources } from '../../../shared/types/kingdom';
import { ErrorCode } from '../../../shared/types/kingdom';
import { log } from '../logger';
import { dbGet, dbUpdate } from '../data-client';

type AllianceRecord = {
  id: string;
  leaderId: string;
  memberIds: string | string[];
  treasury?: unknown;
  stats?: unknown;
  owner?: string | null;
};

type KingdomRecord = {
  id: string;
  owner?: string | null;
  resources?: KingdomResources | null;
};

interface ActiveUpgrade {
  type: string;
  expiresAt: string;
  effect: Record<string, number>;
}

const ALLIANCE_UPGRADES: Record<string, { cost: number; duration: number; description: string; effect: Record<string, number> }> = {
  war_banner:    { cost: 50000,  duration: 48,  description: '+5% offense for all members (48h)',             effect: { combatBonus: 1.05 } },
  fortification: { cost: 100000, duration: 168, description: '+10% defense for all members (7d)',             effect: { defenseBonus: 1.10 } },
  intel_network: { cost: 100000, duration: 168, description: '+15% espionage success (7d)',                   effect: { espionageBonus: 1.15 } },
  trade_routes:  { cost: 75000,  duration: 168, description: '+10% income for all members (7d)',              effect: { incomeBonus: 1.10 } },
  grand_assault: { cost: 200000, duration: 24,  description: '+25% offense for coordinated attacks (24h)',   effect: { coordBonus: 1.25 } },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleContribute(args: { allianceId?: string | null; kingdomId?: string | null; amount?: number | null }, identity: any): Promise<any> {
  const { allianceId, kingdomId, amount } = args;

  if (!allianceId || !kingdomId || amount == null) {
    return { success: false, error: 'Missing required parameters: allianceId, kingdomId, amount', errorCode: ErrorCode.MISSING_PARAMS };
  }

  if (amount <= 0) {
    return { success: false, error: 'Amount must be a positive integer', errorCode: ErrorCode.INVALID_PARAM };
  }

  // Fetch alliance and verify it exists
  const alliance = await dbGet<AllianceRecord>('Alliance', allianceId);
  if (!alliance) {
    return { success: false, error: 'Alliance not found', errorCode: ErrorCode.NOT_FOUND };
  }

  // Fetch kingdom and verify caller owns it
  const kingdom = await dbGet<KingdomRecord>('Kingdom', kingdomId);
  if (!kingdom) {
    return { success: false, error: 'Kingdom not found', errorCode: ErrorCode.NOT_FOUND };
  }

  // Verify caller owns the kingdom via identity
  if (identity?.sub && kingdom.owner !== identity.sub) {
    return { success: false, error: 'Unauthorized: you do not own this kingdom', errorCode: ErrorCode.UNAUTHORIZED };
  }

  const resources = (kingdom.resources ?? {}) as KingdomResources;
  const currentGold = resources.gold ?? 0;

  if (currentGold < amount) {
    return { success: false, error: `Insufficient gold: need ${amount}, have ${currentGold}`, errorCode: ErrorCode.INSUFFICIENT_RESOURCES };
  }

  // Deduct gold from kingdom
  const updatedResources: KingdomResources = {
    ...resources,
    gold: currentGold - amount
  };

  // Update alliance treasury
  const rawTreasury = alliance.treasury;
  const treasury: Record<string, number> = rawTreasury
    ? (typeof rawTreasury === 'string' ? JSON.parse(rawTreasury) : (rawTreasury as Record<string, number>))
    : {};
  treasury.gold = (treasury.gold ?? 0) + amount;

  await dbUpdate('Kingdom', kingdomId, { resources: updatedResources });
  await dbUpdate('Alliance', allianceId, { treasury });

  log.info('alliance-treasury', 'contribute', { allianceId, kingdomId, amount });
  return { success: true, result: JSON.stringify({ contributed: amount, newTreasuryBalance: treasury.gold }) };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleWithdraw(args: { allianceId?: string | null; kingdomId?: string | null; amount?: number | null }, identity: any): Promise<any> {
  const { allianceId, kingdomId, amount } = args;

  if (!allianceId || !kingdomId || amount == null) {
    return { success: false, error: 'Missing required parameters: allianceId, kingdomId, amount', errorCode: ErrorCode.MISSING_PARAMS };
  }

  if (amount <= 0) {
    return { success: false, error: 'Amount must be a positive integer', errorCode: ErrorCode.INVALID_PARAM };
  }

  // Fetch alliance and verify caller is the leader
  const alliance = await dbGet<AllianceRecord>('Alliance', allianceId);
  if (!alliance) {
    return { success: false, error: 'Alliance not found', errorCode: ErrorCode.NOT_FOUND };
  }

  // Verify caller is the alliance leader
  if (identity?.sub && alliance.owner !== identity.sub) {
    return { success: false, error: 'Unauthorized: only the alliance leader can withdraw from the treasury', errorCode: ErrorCode.UNAUTHORIZED };
  }

  // Parse treasury and verify sufficient gold
  const rawTreasury = alliance.treasury;
  const treasury: Record<string, number> = rawTreasury
    ? (typeof rawTreasury === 'string' ? JSON.parse(rawTreasury) : (rawTreasury as Record<string, number>))
    : {};
  const treasuryGold = treasury.gold ?? 0;

  if (treasuryGold < amount) {
    return { success: false, error: `Insufficient treasury gold: need ${amount}, have ${treasuryGold}`, errorCode: ErrorCode.INSUFFICIENT_RESOURCES };
  }

  // Fetch kingdom
  const kingdom = await dbGet<KingdomRecord>('Kingdom', kingdomId);
  if (!kingdom) {
    return { success: false, error: 'Kingdom not found', errorCode: ErrorCode.NOT_FOUND };
  }

  // Add gold to kingdom
  const resources = (kingdom.resources ?? {}) as KingdomResources;
  const updatedResources: KingdomResources = {
    ...resources,
    gold: (resources.gold ?? 0) + amount
  };

  // Deduct from treasury
  treasury.gold = treasuryGold - amount;

  await dbUpdate('Kingdom', kingdomId, { resources: updatedResources });
  await dbUpdate('Alliance', allianceId, { treasury });

  log.info('alliance-treasury', 'withdraw', { allianceId, kingdomId, amount });
  return { success: true, result: JSON.stringify({ withdrawn: amount, newTreasuryBalance: treasury.gold }) };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleUpgrade(args: { allianceId?: string | null; kingdomId?: string | null; upgradeType?: string | null }, identity: any): Promise<any> {
  const { allianceId, kingdomId, upgradeType } = args;

  if (!allianceId || !kingdomId) {
    return { success: false, error: 'Missing required parameters: allianceId, kingdomId', errorCode: ErrorCode.MISSING_PARAMS };
  }

  if (!upgradeType || !ALLIANCE_UPGRADES[upgradeType]) {
    return { success: false, error: 'Invalid upgrade type', errorCode: ErrorCode.INVALID_PARAM };
  }

  const upgrade = ALLIANCE_UPGRADES[upgradeType];
  const alliance = await dbGet<AllianceRecord>('Alliance', allianceId);
  if (!alliance) {
    return { success: false, error: 'Alliance not found', errorCode: ErrorCode.NOT_FOUND };
  }

  // Only leader can purchase upgrades
  if (alliance.leaderId !== kingdomId) {
    return { success: false, error: 'Only alliance leader can purchase upgrades', errorCode: ErrorCode.FORBIDDEN };
  }

  const treasury = typeof alliance.treasury === 'string'
    ? JSON.parse(alliance.treasury as string)
    : (alliance.treasury ?? {}) as Record<string, number>;

  if ((treasury.gold ?? 0) < upgrade.cost) {
    return { success: false, error: `Insufficient treasury gold: need ${upgrade.cost}`, errorCode: ErrorCode.INSUFFICIENT_RESOURCES };
  }

  treasury.gold = (treasury.gold ?? 0) - upgrade.cost;

  const existingStats = typeof alliance.stats === 'string'
    ? JSON.parse(alliance.stats as string)
    : (alliance.stats ?? {});

  const activeUpgrades: ActiveUpgrade[] = (existingStats.activeUpgrades as ActiveUpgrade[]) ?? [];

  // Prune expired upgrades before appending
  const now = Date.now();
  const liveUpgrades = activeUpgrades.filter(u => new Date(u.expiresAt).getTime() > now);

  const expiresAt = new Date(now + upgrade.duration * 60 * 60 * 1000).toISOString();
  liveUpgrades.push({ type: upgradeType, expiresAt, effect: upgrade.effect });

  await dbUpdate('Alliance', allianceId, {
    treasury: JSON.stringify(treasury),
    stats: JSON.stringify({ ...existingStats, activeUpgrades: liveUpgrades }),
  });

  log.info('alliance-treasury', 'upgrade', { allianceId, kingdomId, upgradeType, expiresAt });
  return { success: true, result: JSON.stringify({ upgradeType, expiresAt }) };
}

export const handler: Schema["manageAllianceTreasury"]["functionHandler"] = async (event) => {
  const { allianceId, kingdomId, action, amount } = event.arguments;
  const upgradeType = (event.arguments as Record<string, unknown>).upgradeType as string | undefined;
  const identity = (event as any).identity;

  try {
    if (!action) {
      return { success: false, error: 'Missing required parameter: action', errorCode: ErrorCode.MISSING_PARAMS };
    }

    switch (action) {
      case 'contribute':
        return await handleContribute({ allianceId, kingdomId, amount }, identity);
      case 'withdraw':
        return await handleWithdraw({ allianceId, kingdomId, amount }, identity);
      case 'upgrade':
        return await handleUpgrade({ allianceId, kingdomId, upgradeType }, identity);
      default:
        return { success: false, error: `Invalid action: ${action}. Must be 'contribute', 'withdraw', or 'upgrade'`, errorCode: ErrorCode.INVALID_PARAM };
    }
  } catch (error) {
    log.error('alliance-treasury', error, { allianceId, kingdomId, action, amount });
    return { success: false, error: 'Alliance treasury operation failed', errorCode: ErrorCode.INTERNAL_ERROR };
  }
};
