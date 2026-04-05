import { vi, describe, it, expect, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock ../data-client before importing the handler
// ---------------------------------------------------------------------------

const mockDbGet = vi.hoisted(() => vi.fn());
const mockDbUpdate = vi.hoisted(() => vi.fn());
const mockDbCreate = vi.hoisted(() => vi.fn());
const mockDbList = vi.hoisted(() => vi.fn());
const mockDbDelete = vi.hoisted(() => vi.fn());
const mockDbAtomicAdd = vi.hoisted(() => vi.fn());
const mockDbQuery = vi.hoisted(() => vi.fn());

vi.mock('../data-client', () => ({
  dbGet: mockDbGet,
  dbUpdate: mockDbUpdate,
  dbCreate: mockDbCreate,
  dbList: mockDbList,
  dbDelete: mockDbDelete,
  dbAtomicAdd: mockDbAtomicAdd,
  dbQuery: mockDbQuery,
  parseJsonField: <T>(value: unknown, defaultValue: T): T => {
    if (value === null || value === undefined) return defaultValue;
    if (typeof value === 'string') { try { return JSON.parse(value) as T; } catch { return defaultValue; } }
    return value as T;
  },
  ensureTurnsBalance: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../rate-limiter', () => ({ checkRateLimit: vi.fn().mockResolvedValue(null) }));

import { handler } from './handler';

// ---------------------------------------------------------------------------
// Type helpers
// ---------------------------------------------------------------------------

interface HandlerResult {
  success: boolean;
  result?: string | null;
  error?: string | null;
  errorCode?: string | null;
}

// Cast handler to a simple single-argument callable so tests are not burdened
// by the Amplify Gen2 / AWS Lambda 3-argument (event, context, callback)
// signature, and so that the return type is narrowed to HandlerResult rather
// than the loose JSON union produced by .returns(a.json()).
const callHandler = handler as unknown as (event: unknown) => Promise<HandlerResult>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(fieldName: string, args: Record<string, unknown>) {
  return { info: { fieldName }, arguments: args, identity: { sub: 'test-sub-123', username: 'test-user' } } as any;
}

function mockKingdom(overrides: Record<string, unknown> = {}) {
  return {
    id: 'kingdom-1',
    owner: 'test-sub-123',
    resources: { gold: 10000, population: 5000, mana: 500, land: 1000 },
    buildings: {},
    totalUnits: {},
    stats: {},
    race: 'Human',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockDbUpdate.mockResolvedValue(undefined);
  mockDbList.mockResolvedValue([]);
  mockDbQuery.mockResolvedValue([]);
});

describe('bounty-processor handler — claimBounty', () => {
  describe('happy path', () => {
    it('sets activeBountyTargetId in stats and returns success', async () => {
      mockDbGet.mockResolvedValue(mockKingdom({ stats: {} }));

      const result = await callHandler(
        makeEvent('claimBounty', { kingdomId: 'kingdom-1', targetId: 'target-kingdom' })
      );

      expect(result.success).toBe(true);
      const parsed = JSON.parse(result.result as string);
      expect(parsed.targetId).toBe('target-kingdom');

      const updateCall = mockDbUpdate.mock.calls[0];
      expect(updateCall[2].stats.activeBountyTargetId).toBe('target-kingdom');
      expect(updateCall[2].stats.activeBountyClaimedAt).toBeDefined();
    });
  });

  describe('validation failures', () => {
    it('returns MISSING_PARAMS when kingdomId is absent', async () => {
      const result = await callHandler(
        makeEvent('claimBounty', { targetId: 'target-kingdom' })
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('MISSING_PARAMS');
    });

    it('returns MISSING_PARAMS when targetId is absent', async () => {
      const result = await callHandler(
        makeEvent('claimBounty', { kingdomId: 'kingdom-1' })
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('MISSING_PARAMS');
    });

    it('returns VALIDATION_FAILED when bounty is already active', async () => {
      mockDbGet.mockResolvedValue(
        mockKingdom({ stats: { activeBountyTargetId: 'already-claimed-target' } })
      );

      const result = await callHandler(
        makeEvent('claimBounty', { kingdomId: 'kingdom-1', targetId: 'new-target' })
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('VALIDATION_FAILED');
    });
  });

  describe('NOT_FOUND', () => {
    it('returns NOT_FOUND when kingdom does not exist', async () => {
      mockDbGet.mockResolvedValue(null);

      const result = await callHandler(
        makeEvent('claimBounty', { kingdomId: 'missing-id', targetId: 'target-kingdom' })
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('NOT_FOUND');
    });
  });
});

describe('bounty-processor handler — completeBounty', () => {
  describe('happy path', () => {
    it('calculates gold and population rewards, clears bounty from stats', async () => {
      const claimedAt = new Date(Date.now() - 1000).toISOString();
      mockDbGet.mockResolvedValue(
        mockKingdom({
          stats: { activeBountyTargetId: 'target-kingdom', activeBountyClaimedAt: claimedAt },
          resources: { gold: 5000, population: 2000, mana: 500, land: 1000 },
        })
      );
      // Mock BattleReport query to verify landGained
      mockDbQuery.mockResolvedValue([
        { attackerId: 'kingdom-1', defenderId: 'target-kingdom', landGained: 2000, timestamp: new Date().toISOString() },
      ]);

      const result = await callHandler(
        makeEvent('completeBounty', { kingdomId: 'kingdom-1', targetId: 'target-kingdom', landGained: 2000 })
      );

      expect(result.success).toBe(true);
      const parsed = JSON.parse(result.result as string);

      // goldReward = floor(2000 * 500) = 1_000_000
      expect(parsed.goldReward).toBe(1_000_000);

      // structuresGained = floor(2000 * 0.36) = 720
      expect(parsed.structuresGained).toBe(720);

      // populationReward = 720 * 2 = 1440
      expect(parsed.populationReward).toBe(1440);

      const updateCall = mockDbUpdate.mock.calls[0];
      expect(updateCall[2].resources.gold).toBe(5000 + 1_000_000);
      expect(updateCall[2].resources.population).toBe(2000 + 1440);
      // Bounty stats cleared
      expect(updateCall[2].stats.activeBountyTargetId).toBeUndefined();
      // Completion counter incremented from 0 to 1
      expect(updateCall[2].stats.bountyCompletions).toBe(1);
    });

    it('increments bountyCompletions from existing value', async () => {
      const claimedAt = new Date(Date.now() - 1000).toISOString();
      mockDbGet.mockResolvedValue(
        mockKingdom({
          stats: { activeBountyTargetId: 'target-kingdom', activeBountyClaimedAt: claimedAt, bountyCompletions: 5 },
          resources: { gold: 5000, population: 2000, mana: 500, land: 1000 },
        })
      );
      // Mock BattleReport query to verify landGained
      mockDbQuery.mockResolvedValue([
        { attackerId: 'kingdom-1', defenderId: 'target-kingdom', landGained: 2000, timestamp: new Date().toISOString() },
      ]);

      const result = await callHandler(
        makeEvent('completeBounty', { kingdomId: 'kingdom-1', targetId: 'target-kingdom', landGained: 2000 })
      );

      expect(result.success).toBe(true);
      const updateCall = mockDbUpdate.mock.calls[0];
      expect(updateCall[2].stats.bountyCompletions).toBe(6);
    });
  });

  describe('validation failures', () => {
    it('returns MISSING_PARAMS when kingdomId is absent', async () => {
      const result = await callHandler(
        makeEvent('completeBounty', { targetId: 'target-kingdom', landGained: 1000 })
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('MISSING_PARAMS');
    });

    it('returns MISSING_PARAMS when landGained is absent', async () => {
      const result = await callHandler(
        makeEvent('completeBounty', { kingdomId: 'kingdom-1', targetId: 'target-kingdom' })
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('MISSING_PARAMS');
    });

    it('returns INVALID_PARAM when landGained is below 1000', async () => {
      const result = await callHandler(
        makeEvent('completeBounty', { kingdomId: 'kingdom-1', targetId: 'target-kingdom', landGained: 500 })
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_PARAM');
    });

    it('returns VALIDATION_FAILED when targetId does not match active bounty', async () => {
      mockDbGet.mockResolvedValue(
        mockKingdom({ stats: { activeBountyTargetId: 'different-target' } })
      );

      const result = await callHandler(
        makeEvent('completeBounty', { kingdomId: 'kingdom-1', targetId: 'wrong-target', landGained: 1000 })
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('VALIDATION_FAILED');
    });
  });

  describe('NOT_FOUND', () => {
    it('returns NOT_FOUND when kingdom does not exist', async () => {
      mockDbGet.mockResolvedValue(null);

      const result = await callHandler(
        makeEvent('completeBounty', { kingdomId: 'missing-id', targetId: 'target', landGained: 1500 })
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('NOT_FOUND');
    });
  });
});

describe('bounty-processor handler — unknown mutation', () => {
  it('returns INVALID_PARAM for an unrecognised fieldName', async () => {
    const result = await callHandler(makeEvent('grantBounty', { kingdomId: 'kingdom-1' }));

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('INVALID_PARAM');
  });
});
