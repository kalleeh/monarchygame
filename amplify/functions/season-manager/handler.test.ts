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

vi.mock('../data-client', () => ({
  dbGet: mockDbGet,
  dbUpdate: mockDbUpdate,
  dbCreate: mockDbCreate,
  dbList: mockDbList,
  dbDelete: mockDbDelete,
  dbAtomicAdd: mockDbAtomicAdd,
  parseJsonField: <T>(value: unknown, defaultValue: T): T => {
    if (value === null || value === undefined) return defaultValue;
    if (typeof value === 'string') { try { return JSON.parse(value) as T; } catch { return defaultValue; } }
    return value as T;
  },
  ensureTurnsBalance: vi.fn().mockResolvedValue(undefined),
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

/** Returns a season that started 1 hour ago — clearly in 'early' age. */
function freshActiveSeason(overrides: Record<string, unknown> = {}) {
  const recentStart = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1 hour ago
  return {
    id: 'season-1',
    seasonNumber: 3,
    status: 'active',
    startDate: recentStart,
    currentAge: 'early',
    ageTransitions: JSON.stringify({ early: recentStart }),
    participantCount: 0,
    ...overrides,
  };
}

/** Returns a season that started 7 weeks ago — expired. */
function expiredSeason(overrides: Record<string, unknown> = {}) {
  const oldStart = new Date(Date.now() - 7 * 7 * 24 * 60 * 60 * 1000).toISOString();
  return {
    id: 'season-old',
    seasonNumber: 2,
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
  mockDbUpdate.mockResolvedValue(undefined);
});

describe('season-manager handler — getActiveSeason', () => {
  describe('active season exists', () => {
    it('returns season details including currentAge and weeksRemaining', async () => {
      const season = freshActiveSeason();
      mockDbList.mockResolvedValue([season]);

      const result = await callHandler(makeEvent({}));

      const parsed = JSON.parse(result as string);
      expect(parsed.success).toBe(true);
      expect(parsed.season.id).toBe('season-1');
      expect(parsed.season.seasonNumber).toBe(3);
      expect(parsed.season.status).toBe('active');
      expect(parsed.season.currentAge).toBe('early');
      expect(parsed.season.weeksRemaining).toBeGreaterThan(0);
    });

    it('does not call update when currentAge has not changed', async () => {
      const season = freshActiveSeason({ currentAge: 'early' });
      mockDbList.mockResolvedValue([season]);

      await callHandler(makeEvent({}));

      expect(mockDbUpdate).not.toHaveBeenCalled();
    });

    it('calls update when currentAge needs to transition', async () => {
      // Season started 3 weeks ago → weeksElapsed = 3, which is >= 2 but < 4, so 'middle'
      const threeWeeksAgo = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString();
      const season = freshActiveSeason({ startDate: threeWeeksAgo, currentAge: 'early' });
      mockDbList.mockResolvedValue([season]);

      await callHandler(makeEvent({}));

      expect(mockDbUpdate).toHaveBeenCalledWith(
        'GameSeason',
        'season-1',
        expect.objectContaining({ currentAge: 'middle' })
      );
    });
  });

  describe('no active season', () => {
    it('returns SEASON_INACTIVE error when no seasons are found', async () => {
      mockDbList.mockResolvedValue([]);

      const result = await callHandler(makeEvent({}));

      const parsed = JSON.parse(result as string);
      expect(parsed.success).toBe(false);
      expect(parsed.errorCode).toBe('SEASON_INACTIVE');
    });

    it('returns SEASON_INACTIVE when data is empty', async () => {
      mockDbList.mockResolvedValue([]);

      const result = await callHandler(makeEvent({}));

      const parsed = JSON.parse(result as string);
      expect(parsed.success).toBe(false);
      expect(parsed.errorCode).toBe('SEASON_INACTIVE');
    });
  });

  describe('expired season', () => {
    it('marks expired season as completed and returns SEASON_INACTIVE', async () => {
      const season = expiredSeason();
      mockDbList.mockResolvedValue([season]);

      const result = await callHandler(makeEvent({}));

      const parsed = JSON.parse(result as string);
      expect(parsed.success).toBe(false);
      expect(parsed.errorCode).toBe('SEASON_INACTIVE');
      expect(mockDbUpdate).toHaveBeenCalledWith(
        'GameSeason',
        'season-old',
        expect.objectContaining({ status: 'completed' })
      );
    });
  });

  describe('error handling', () => {
    it('returns INTERNAL_ERROR on unexpected exception', async () => {
      mockDbList.mockRejectedValue(new Error('DynamoDB offline'));

      const result = await callHandler(makeEvent({}));

      const parsed = JSON.parse(result as string);
      expect(parsed.success).toBe(false);
      expect(parsed.errorCode).toBe('INTERNAL_ERROR');
    });
  });
});
