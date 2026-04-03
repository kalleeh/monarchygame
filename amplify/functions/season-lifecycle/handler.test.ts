import { vi, describe, it, expect, beforeEach } from 'vitest';

// Set ADMIN_USER_IDS before the handler module is loaded (it reads env at import time)
vi.hoisted(() => { process.env.ADMIN_USER_IDS = 'test-sub-123'; });

// ---------------------------------------------------------------------------
// Mock ../data-client before importing the handler
// ---------------------------------------------------------------------------

const mockDbGet = vi.hoisted(() => vi.fn());
const mockDbUpdate = vi.hoisted(() => vi.fn());
const mockDbCreate = vi.hoisted(() => vi.fn());
const mockDbList = vi.hoisted(() => vi.fn());
const mockDbDelete = vi.hoisted(() => vi.fn());
const mockDbAtomicAdd = vi.hoisted(() => vi.fn());
const mockDbBatchWrite = vi.hoisted(() => vi.fn());
const mockGetTableSuffix = vi.hoisted(() => vi.fn());

vi.mock('../data-client', () => ({
  dbGet: mockDbGet,
  dbUpdate: mockDbUpdate,
  dbCreate: mockDbCreate,
  dbList: mockDbList,
  dbDelete: mockDbDelete,
  dbAtomicAdd: mockDbAtomicAdd,
  dbBatchWrite: mockDbBatchWrite,
  getTableSuffix: mockGetTableSuffix,
  parseJsonField: <T>(value: unknown, defaultValue: T): T => {
    if (value === null || value === undefined) return defaultValue;
    if (typeof value === 'string') { try { return JSON.parse(value) as T; } catch { return defaultValue; } }
    return value as T;
  },
}));

import { handler } from './handler';

// ---------------------------------------------------------------------------
// Type helpers
// ---------------------------------------------------------------------------

// Cast handler to a simple single-argument callable so tests are not burdened
// by the Amplify Gen2 / AWS Lambda 3-argument (event, context, callback)
// signature, and so that the return type is narrowed to string rather than
// the loose JSON union produced by .returns(a.json()).
const callHandler = handler as unknown as (event: unknown) => Promise<string>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(args: Record<string, unknown>) {
  return { arguments: args, identity: { sub: 'test-sub-123', username: 'test-user' } } as any;
}

/** A season that started 1 hour ago — in 'early' age, not expired. */
function freshSeason(overrides: Record<string, unknown> = {}) {
  const recentStart = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  return {
    id: 'season-1',
    seasonNumber: 1,
    status: 'active',
    startDate: recentStart,
    currentAge: 'early',
    ageTransitions: JSON.stringify({ early: recentStart }),
    participantCount: 0,
    ...overrides,
  };
}

/** A season that started 7 weeks ago — expired. */
function expiredSeason(overrides: Record<string, unknown> = {}) {
  const oldStart = new Date(Date.now() - 7 * 7 * 24 * 60 * 60 * 1000).toISOString();
  return {
    id: 'season-old',
    seasonNumber: 1,
    status: 'active',
    startDate: oldStart,
    currentAge: 'late',
    ageTransitions: JSON.stringify({}),
    participantCount: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockDbCreate.mockResolvedValue({ id: 'new-season-1', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), __typename: 'GameSeason' });
  mockDbUpdate.mockResolvedValue(undefined);
  mockDbList.mockResolvedValue([]);
  mockDbGet.mockResolvedValue(null);
  mockDbBatchWrite.mockResolvedValue(undefined);
  mockGetTableSuffix.mockResolvedValue('test-suffix');
});

describe('season-lifecycle handler — create action', () => {
  describe('happy path', () => {
    it('creates a new season with seasonNumber incremented from the current max', async () => {
      // Single dbList call: no active seasons but has prior seasons for max number check
      mockDbList.mockImplementation(async (model: string) => {
        if (model === 'GameSeason') return [{ seasonNumber: 5, status: 'completed' }, { seasonNumber: 3, status: 'completed' }];
        if (model === 'Kingdom') return []; // seedAIKingdoms check
        return [];
      });

      const result = await callHandler(makeEvent({ action: 'create' }));

      const parsed = JSON.parse(result as string);
      expect(parsed.success).toBe(true);
      expect(parsed.season.seasonNumber).toBe(6);
      expect(parsed.season.status).toBe('active');
      expect(parsed.season.currentAge).toBe('early');

      expect(mockDbCreate).toHaveBeenCalledWith(
        'GameSeason',
        expect.objectContaining({ seasonNumber: 6, status: 'active', currentAge: 'early' })
      );
    });

    it('starts at season 1 when no prior seasons exist', async () => {
      mockDbList.mockImplementation(async (model: string) => {
        if (model === 'GameSeason') return [];
        if (model === 'Kingdom') return []; // seedAIKingdoms check
        return [];
      });

      const result = await callHandler(makeEvent({ action: 'create' }));

      const parsed = JSON.parse(result as string);
      expect(parsed.success).toBe(true);
      expect(parsed.season.seasonNumber).toBe(1);
    });
  });

  describe('validation failures', () => {
    it('returns VALIDATION_FAILED when an active season already exists', async () => {
      mockDbList.mockResolvedValue([freshSeason()]);

      const result = await callHandler(makeEvent({ action: 'create' }));

      const parsed = JSON.parse(result as string);
      expect(parsed.success).toBe(false);
      expect(parsed.errorCode).toBe('VALIDATION_FAILED');
      expect(mockDbCreate).not.toHaveBeenCalled();
    });
  });
});

describe('season-lifecycle handler — check action', () => {
  it('returns no-change when season is active and age is unchanged', async () => {
    mockDbList.mockResolvedValue([freshSeason()]);

    const result = await callHandler(makeEvent({ action: 'check' }));

    const parsed = JSON.parse(result as string);
    expect(parsed.success).toBe(true);
    expect(parsed.processed[0].action).toBe('no_change');
    expect(mockDbUpdate).not.toHaveBeenCalled();
  });

  it('marks expired season as completed and expires open trade offers', async () => {
    const offerSellerId = 'seller-1';
    mockDbList.mockImplementation(async (model: string) => {
      if (model === 'GameSeason') return [expiredSeason()];
      if (model === 'TradeOffer') return [{ id: 'offer-1', seasonId: 'season-old', sellerId: offerSellerId, resourceType: 'gold', quantity: 100, status: 'open' }];
      if (model === 'Kingdom') return []; // recordSeasonRankings
      return [];
    });
    mockDbGet.mockImplementation(async (model: string) => {
      if (model === 'Kingdom') return { id: offerSellerId, resources: { gold: 0 } };
      return null;
    });

    const result = await callHandler(makeEvent({ action: 'check' }));

    const parsed = JSON.parse(result as string);
    expect(parsed.success).toBe(true);
    expect(parsed.processed[0].action).toBe('completed');

    // Season marked completed
    expect(mockDbUpdate).toHaveBeenCalledWith(
      'GameSeason',
      'season-old',
      expect.objectContaining({ status: 'completed' })
    );
    // Trade offer expired
    expect(mockDbUpdate).toHaveBeenCalledWith('TradeOffer', 'offer-1', { status: 'expired' });
    // Seller refunded
    expect(mockDbUpdate).toHaveBeenCalledWith('Kingdom', offerSellerId, expect.anything());
  });

  it('returns no active seasons message when none exist', async () => {
    mockDbList.mockResolvedValue([]);

    const result = await callHandler(makeEvent({ action: 'check' }));

    const parsed = JSON.parse(result as string);
    expect(parsed.success).toBe(true);
    expect(parsed.message).toBe('No active seasons to process');
  });

  it('transitions age when enough time has passed', async () => {
    // Season started 3 weeks ago → weeksElapsed = 3, which is >= 2 but < 4, so 'middle' age
    const threeWeeksAgo = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString();
    const season = freshSeason({ startDate: threeWeeksAgo, currentAge: 'early' });
    mockDbList.mockResolvedValue([season]);

    const result = await callHandler(makeEvent({ action: 'check' }));

    const parsed = JSON.parse(result as string);
    expect(parsed.success).toBe(true);
    expect(parsed.processed[0].action).toBe('age_transition');
    expect(parsed.processed[0].from).toBe('early');
    expect(parsed.processed[0].to).toBe('middle');
  });
});

describe('season-lifecycle handler — end action', () => {
  it('force-ends a specific season', async () => {
    mockDbGet.mockResolvedValue({ id: 'season-2', status: 'active', seasonNumber: 2 });

    const result = await callHandler(makeEvent({ action: 'end', seasonId: 'season-2' }));

    const parsed = JSON.parse(result as string);
    expect(parsed.success).toBe(true);
    expect(parsed.action).toBe('force_ended');
    expect(parsed.seasonId).toBe('season-2');

    expect(mockDbUpdate).toHaveBeenCalledWith(
      'GameSeason',
      'season-2',
      expect.objectContaining({ status: 'completed' })
    );
  });

  it('includes allianceName in victoryResults stored on the season', async () => {
    // Season to end
    mockDbGet.mockImplementation(async (model: string, id: string) => {
      if (model === 'GameSeason') return { id: 'season-3', status: 'active', seasonNumber: 3, ageTransitions: JSON.stringify({}) };
      if (model === 'Alliance') return { id, name: 'Iron Fist' };
      if (model === 'Kingdom') return null;
      return null;
    });

    // Kingdoms belonging to alliance 'alliance-a', with land+gold resources
    mockDbList.mockImplementation(async (model: string) => {
      if (model === 'Kingdom') return [
        { id: 'k1', guildId: 'alliance-a', resources: JSON.stringify({ gold: 1000, land: 10 }), isActive: true, stats: '{}' },
      ];
      if (model === 'BattleReport') return [
        { attackerId: 'k1', landGained: 50 },
      ];
      if (model === 'Territory') return [
        { kingdomId: 'k1', regionId: 'region-1' },
        { kingdomId: 'k1', regionId: 'region-1' },
        { kingdomId: 'k1', regionId: 'region-1' },
      ];
      return [];
    });

    await callHandler(makeEvent({ action: 'end', seasonId: 'season-3' }));

    // Find the dbUpdate call that stores ageTransitions with victoryResults
    const updateCall = mockDbUpdate.mock.calls.find(
      (c: unknown[]) => c[0] === 'GameSeason' && c[1] === 'season-3'
    );
    expect(updateCall).toBeDefined();
    const updatePayload = updateCall![2] as Record<string, unknown>;
    const transitions = JSON.parse(updatePayload.ageTransitions as string) as Record<string, unknown>;
    const victoryResults = transitions.victoryResults as {
      militaryChampion?: { allianceName: string };
      economicPowerhouse?: { allianceName: string };
      strategistGuild?: { allianceName: string };
    };

    expect(victoryResults.militaryChampion?.allianceName).toBe('Iron Fist');
    expect(victoryResults.economicPowerhouse?.allianceName).toBe('Iron Fist');
    expect(victoryResults.strategistGuild?.allianceName).toBe('Iron Fist');
  });

  it('returns MISSING_PARAMS when seasonId is absent for end action', async () => {
    const result = await callHandler(makeEvent({ action: 'end' }));

    const parsed = JSON.parse(result as string);
    expect(parsed.success).toBe(false);
    expect(parsed.errorCode).toBe('MISSING_PARAMS');
  });

  it('returns NOT_FOUND when season does not exist', async () => {
    mockDbGet.mockResolvedValue(null);

    const result = await callHandler(makeEvent({ action: 'end', seasonId: 'ghost-season' }));

    const parsed = JSON.parse(result as string);
    expect(parsed.success).toBe(false);
    expect(parsed.errorCode).toBe('NOT_FOUND');
  });
});

describe('season-lifecycle handler — unknown action', () => {
  it('returns INVALID_PARAM for an unrecognised action', async () => {
    const result = await callHandler(makeEvent({ action: 'rewind' }));

    const parsed = JSON.parse(result as string);
    expect(parsed.success).toBe(false);
    expect(parsed.errorCode).toBe('INVALID_PARAM');
  });
});

describe('season-lifecycle handler — rankings on season end', () => {
  it('sets previousSeasonRank and previousSeasonNetworth on each kingdom, ordered by networth', async () => {
    // Three kingdoms with different networthes
    // Kingdom A: land=1000 => 1,000,000 + gold=50,000 = 1,050,000
    // Kingdom B: land=500  => 500,000 + gold=20,000   = 520,000
    // Kingdom C: land=200  => 200,000 + gold=5,000    = 205,000
    const kingdomA = { id: 'k-a', isActive: true, resources: JSON.stringify({ land: 1000, gold: 50000 }), stats: '{}' };
    const kingdomB = { id: 'k-b', isActive: true, resources: JSON.stringify({ land: 500, gold: 20000 }),  stats: '{}' };
    const kingdomC = { id: 'k-c', isActive: true, resources: JSON.stringify({ land: 200, gold: 5000 }),   stats: '{}' };

    mockDbGet.mockImplementation(async (model: string, id: string) => {
      if (model === 'GameSeason') return { id: 'season-end', status: 'active', seasonNumber: 7, ageTransitions: '{}' };
      return null;
    });

    mockDbList.mockImplementation(async (model: string) => {
      if (model === 'Kingdom') return [kingdomA, kingdomB, kingdomC];
      if (model === 'BattleReport') return [];
      if (model === 'Territory') return [];
      if (model === 'TradeOffer') return [];
      return [];
    });

    await callHandler(makeEvent({ action: 'end', seasonId: 'season-end' }));

    // Collect all dbUpdate calls for Kingdom
    const kingdomUpdates = mockDbUpdate.mock.calls.filter(
      (call: unknown[]) => call[0] === 'Kingdom'
    ) as [string, string, Record<string, unknown>][];

    // Helper to find the stats update for a given kingdom id
    const getStatsUpdate = (id: string) =>
      kingdomUpdates.find(call => call[1] === id)?.[2].stats as Record<string, unknown> | undefined;

    const statsA = getStatsUpdate('k-a');
    const statsB = getStatsUpdate('k-b');
    const statsC = getStatsUpdate('k-c');

    expect(statsA).toBeDefined();
    expect(statsB).toBeDefined();
    expect(statsC).toBeDefined();

    // Highest networth = rank 1
    expect(statsA!.previousSeasonRank).toBe(1);
    expect(statsB!.previousSeasonRank).toBe(2);
    expect(statsC!.previousSeasonRank).toBe(3);

    expect(statsA!.previousSeasonNetworth).toBe(1050000);
    expect(statsB!.previousSeasonNetworth).toBe(520000);
    expect(statsC!.previousSeasonNetworth).toBe(205000);
  });
});

describe('season-lifecycle handler — empty season (no kingdoms)', () => {
  it('completes without error when there are no kingdoms', async () => {
    mockDbGet.mockImplementation(async (model: string) => {
      if (model === 'GameSeason') return { id: 'season-empty', status: 'active', seasonNumber: 2, ageTransitions: '{}' };
      return null;
    });

    mockDbList.mockImplementation(async (model: string) => {
      if (model === 'Kingdom') return [];
      if (model === 'BattleReport') return [];
      if (model === 'Territory') return [];
      if (model === 'TradeOffer') return [];
      return [];
    });

    const result = await callHandler(makeEvent({ action: 'end', seasonId: 'season-empty' }));

    const parsed = JSON.parse(result as string);
    expect(parsed.success).toBe(true);
  });
});

describe('season-lifecycle handler — age transition', () => {
  it('transitions from early to middle when the season is past the age boundary', async () => {
    // Season started 3 weeks ago → weeksElapsed=3 ≥ AGE_DURATION_WEEKS(2), so 'middle'
    const threeWeeksAgo = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString();
    const season = freshSeason({ startDate: threeWeeksAgo, currentAge: 'early' });

    mockDbList.mockResolvedValue([season]);

    const result = await callHandler(makeEvent({ action: 'check' }));

    const parsed = JSON.parse(result as string);
    expect(parsed.success).toBe(true);

    const transition = parsed.processed[0];
    expect(transition.action).toBe('age_transition');
    expect(transition.from).toBe('early');
    expect(transition.to).toBe('middle');

    expect(mockDbUpdate).toHaveBeenCalledWith(
      'GameSeason',
      season.id,
      expect.objectContaining({ currentAge: 'middle' })
    );
  });
});
