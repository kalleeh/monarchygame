import { vi, describe, it, expect, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock aws-amplify/data before importing the handler
// ---------------------------------------------------------------------------

const mockClient = vi.hoisted(() => ({
  models: {
    GameSeason: {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      get: vi.fn(),
    },
  },
}));

vi.mock('aws-amplify/data', () => ({
  generateClient: () => mockClient,
}));

import { handler } from './handler';

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
  mockClient.models.GameSeason.update.mockResolvedValue({ data: {}, errors: null });
});

describe('season-manager handler — getActiveSeason', () => {
  describe('active season exists', () => {
    it('returns season details including currentAge and weeksRemaining', async () => {
      const season = freshActiveSeason();
      mockClient.models.GameSeason.list.mockResolvedValue({ data: [season], errors: null });

      const result = await handler(makeEvent({}));

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
      mockClient.models.GameSeason.list.mockResolvedValue({ data: [season], errors: null });

      await handler(makeEvent({}));

      expect(mockClient.models.GameSeason.update).not.toHaveBeenCalled();
    });

    it('calls update when currentAge needs to transition', async () => {
      // Season started 3 weeks ago → weeksElapsed = 3, which is >= 2 but < 4, so 'middle'
      const threeWeeksAgo = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString();
      const season = freshActiveSeason({ startDate: threeWeeksAgo, currentAge: 'early' });
      mockClient.models.GameSeason.list.mockResolvedValue({ data: [season], errors: null });

      await handler(makeEvent({}));

      expect(mockClient.models.GameSeason.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'season-1', currentAge: 'middle' })
      );
    });
  });

  describe('no active season', () => {
    it('returns SEASON_INACTIVE error when no seasons are found', async () => {
      mockClient.models.GameSeason.list.mockResolvedValue({ data: [], errors: null });

      const result = await handler(makeEvent({}));

      const parsed = JSON.parse(result as string);
      expect(parsed.success).toBe(false);
      expect(parsed.errorCode).toBe('SEASON_INACTIVE');
    });

    it('returns SEASON_INACTIVE when data is null', async () => {
      mockClient.models.GameSeason.list.mockResolvedValue({ data: null, errors: null });

      const result = await handler(makeEvent({}));

      const parsed = JSON.parse(result as string);
      expect(parsed.success).toBe(false);
      expect(parsed.errorCode).toBe('SEASON_INACTIVE');
    });
  });

  describe('expired season', () => {
    it('marks expired season as completed and returns SEASON_INACTIVE', async () => {
      const season = expiredSeason();
      mockClient.models.GameSeason.list.mockResolvedValue({ data: [season], errors: null });

      const result = await handler(makeEvent({}));

      const parsed = JSON.parse(result as string);
      expect(parsed.success).toBe(false);
      expect(parsed.errorCode).toBe('SEASON_INACTIVE');
      expect(mockClient.models.GameSeason.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'season-old', status: 'completed' })
      );
    });
  });

  describe('error handling', () => {
    it('returns INTERNAL_ERROR on unexpected exception', async () => {
      mockClient.models.GameSeason.list.mockRejectedValue(new Error('DynamoDB offline'));

      const result = await handler(makeEvent({}));

      const parsed = JSON.parse(result as string);
      expect(parsed.success).toBe(false);
      expect(parsed.errorCode).toBe('INTERNAL_ERROR');
    });
  });
});
