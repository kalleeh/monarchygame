import type { Schema } from '../../data/resource';
import { generateClient } from 'aws-amplify/data';
import type { KingdomResources } from '../../../shared/types/kingdom';
import { ErrorCode } from '../../../shared/types/kingdom';
import { log } from '../logger';
import { configureAmplify } from '../amplify-configure';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let client: ReturnType<typeof generateClient<Schema>>;

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
  const allianceResult = await client.models.Alliance.get({ id: allianceId });
  if (!allianceResult.data) {
    return { success: false, error: 'Alliance not found', errorCode: ErrorCode.NOT_FOUND };
  }

  // Fetch kingdom and verify caller owns it
  const kingdomResult = await client.models.Kingdom.get({ id: kingdomId });
  if (!kingdomResult.data) {
    return { success: false, error: 'Kingdom not found', errorCode: ErrorCode.NOT_FOUND };
  }

  // Verify caller owns the kingdom via identity
  if (identity?.sub && kingdomResult.data.owner !== identity.sub) {
    return { success: false, error: 'Unauthorized: you do not own this kingdom', errorCode: ErrorCode.UNAUTHORIZED };
  }

  const resources = (kingdomResult.data.resources ?? {}) as KingdomResources;
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
  const rawTreasury = allianceResult.data.treasury;
  const treasury: Record<string, number> = rawTreasury
    ? (typeof rawTreasury === 'string' ? JSON.parse(rawTreasury) : (rawTreasury as Record<string, number>))
    : {};
  treasury.gold = (treasury.gold ?? 0) + amount;

  await client.models.Kingdom.update({ id: kingdomId, resources: updatedResources });
  await client.models.Alliance.update({ id: allianceId, treasury });

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
  const allianceResult = await client.models.Alliance.get({ id: allianceId });
  if (!allianceResult.data) {
    return { success: false, error: 'Alliance not found', errorCode: ErrorCode.NOT_FOUND };
  }

  // Verify caller is the alliance leader
  if (identity?.sub && allianceResult.data.owner !== identity.sub) {
    return { success: false, error: 'Unauthorized: only the alliance leader can withdraw from the treasury', errorCode: ErrorCode.UNAUTHORIZED };
  }

  // Parse treasury and verify sufficient gold
  const rawTreasury = allianceResult.data.treasury;
  const treasury: Record<string, number> = rawTreasury
    ? (typeof rawTreasury === 'string' ? JSON.parse(rawTreasury) : (rawTreasury as Record<string, number>))
    : {};
  const treasuryGold = treasury.gold ?? 0;

  if (treasuryGold < amount) {
    return { success: false, error: `Insufficient treasury gold: need ${amount}, have ${treasuryGold}`, errorCode: ErrorCode.INSUFFICIENT_RESOURCES };
  }

  // Fetch kingdom
  const kingdomResult = await client.models.Kingdom.get({ id: kingdomId });
  if (!kingdomResult.data) {
    return { success: false, error: 'Kingdom not found', errorCode: ErrorCode.NOT_FOUND };
  }

  // Add gold to kingdom
  const resources = (kingdomResult.data.resources ?? {}) as KingdomResources;
  const updatedResources: KingdomResources = {
    ...resources,
    gold: (resources.gold ?? 0) + amount
  };

  // Deduct from treasury
  treasury.gold = treasuryGold - amount;

  await client.models.Kingdom.update({ id: kingdomId, resources: updatedResources });
  await client.models.Alliance.update({ id: allianceId, treasury });

  log.info('alliance-treasury', 'withdraw', { allianceId, kingdomId, amount });
  return { success: true, result: JSON.stringify({ withdrawn: amount, newTreasuryBalance: treasury.gold }) };
}

export const handler: Schema["manageAllianceTreasury"]["functionHandler"] = async (event) => {
  await configureAmplify();
  client = generateClient<Schema>({ authMode: 'iam' });
  const { allianceId, kingdomId, action, amount } = event.arguments;
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
      default:
        return { success: false, error: `Invalid action: ${action}. Must be 'contribute' or 'withdraw'`, errorCode: ErrorCode.INVALID_PARAM };
    }
  } catch (error) {
    log.error('alliance-treasury', error, { allianceId, kingdomId, action, amount });
    return { success: false, error: 'Alliance treasury operation failed', errorCode: ErrorCode.INTERNAL_ERROR };
  }
};
