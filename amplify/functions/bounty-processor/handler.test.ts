import { vi, describe, it, expect, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock aws-amplify/data before importing the handler
// ---------------------------------------------------------------------------

const mockClient = vi.hoisted(() => ({
  models: {
    Kingdom: {
      get: vi.fn(),
      update: vi.fn(),
      list: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock('aws-amplify/data', () => ({
  generateClient: () => mockClient,
}));

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
    data: {
      id: 'kingdom-1',
      owner: 'test-user::owner',
      resources: { gold: 10000, population: 5000, mana: 500, land: 1000 },
      buildings: {},
      totalUnits: {},
      stats: {},
      race: 'Human',
      ...overrides,
    },
    errors: null,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockClient.models.Kingdom.update.mockResolvedValue({ data: {}, errors: null });
});

describe('bounty-processor handler — claimBounty', () => {
  describe('happy path', () => {
    it('sets activeBountyTargetId in stats and returns success', async () => {
      mockClient.models.Kingdom.get.mockResolvedValue(mockKingdom({ stats: {} }));

      const result = await callHandler(
        makeEvent('claimBounty', { kingdomId: 'kingdom-1', targetId: 'target-kingdom' })
      );

      expect(result.success).toBe(true);
      const parsed = JSON.parse(result.result as string);
      expect(parsed.targetId).toBe('target-kingdom');

      const updateCall = mockClient.models.Kingdom.update.mock.calls[0][0];
      expect(updateCall.stats.activeBountyTargetId).toBe('target-kingdom');
      expect(updateCall.stats.activeBountyClaimedAt).toBeDefined();
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
      mockClient.models.Kingdom.get.mockResolvedValue(
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
      mockClient.models.Kingdom.get.mockResolvedValue({ data: null, errors: null });

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
      mockClient.models.Kingdom.get.mockResolvedValue(
        mockKingdom({
          stats: { activeBountyTargetId: 'target-kingdom', activeBountyClaimedAt: Date.now() - 1000 },
          resources: { gold: 5000, population: 2000, mana: 500, land: 1000 },
        })
      );

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

      const updateCall = mockClient.models.Kingdom.update.mock.calls[0][0];
      expect(updateCall.resources.gold).toBe(5000 + 1_000_000);
      expect(updateCall.resources.population).toBe(2000 + 1440);
      // Bounty stats cleared
      expect(updateCall.stats.activeBountyTargetId).toBeUndefined();
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
      mockClient.models.Kingdom.get.mockResolvedValue(
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
      mockClient.models.Kingdom.get.mockResolvedValue({ data: null, errors: null });

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
