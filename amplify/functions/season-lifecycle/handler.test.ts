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
    },
    GameSeason: {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      get: vi.fn(),
    },
    TradeOffer: {
      list: vi.fn(),
      update: vi.fn(),
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
  mockClient.models.GameSeason.create.mockResolvedValue({ data: { id: 'new-season-1' }, errors: null });
  mockClient.models.GameSeason.update.mockResolvedValue({ data: {}, errors: null });
  mockClient.models.TradeOffer.list.mockResolvedValue({ data: [], errors: null });
  mockClient.models.TradeOffer.update.mockResolvedValue({ data: {}, errors: null });
  mockClient.models.Kingdom.get.mockResolvedValue({ data: null, errors: null });
  mockClient.models.Kingdom.update.mockResolvedValue({ data: {}, errors: null });
  // recordSeasonRankings calls Kingdom.list — default to empty list
  mockClient.models.Kingdom.list.mockResolvedValue({ data: [], errors: null });
});

describe('season-lifecycle handler — create action', () => {
  describe('happy path', () => {
    it('creates a new season with seasonNumber incremented from the current max', async () => {
      // No active season
      mockClient.models.GameSeason.list
        .mockResolvedValueOnce({ data: [], errors: null })   // active seasons check
        .mockResolvedValueOnce({                              // all seasons for max number
          data: [{ seasonNumber: 5 }, { seasonNumber: 3 }],
          errors: null,
        });

      const result = await callHandler(makeEvent({ action: 'create' }));

      const parsed = JSON.parse(result as string);
      expect(parsed.success).toBe(true);
      expect(parsed.season.seasonNumber).toBe(6);
      expect(parsed.season.status).toBe('active');
      expect(parsed.season.currentAge).toBe('early');

      expect(mockClient.models.GameSeason.create).toHaveBeenCalledWith(
        expect.objectContaining({ seasonNumber: 6, status: 'active', currentAge: 'early' })
      );
    });

    it('starts at season 1 when no prior seasons exist', async () => {
      mockClient.models.GameSeason.list
        .mockResolvedValueOnce({ data: [], errors: null })
        .mockResolvedValueOnce({ data: [], errors: null });

      const result = await callHandler(makeEvent({ action: 'create' }));

      const parsed = JSON.parse(result as string);
      expect(parsed.success).toBe(true);
      expect(parsed.season.seasonNumber).toBe(1);
    });
  });

  describe('validation failures', () => {
    it('returns VALIDATION_FAILED when an active season already exists', async () => {
      mockClient.models.GameSeason.list.mockResolvedValue({
        data: [freshSeason()],
        errors: null,
      });

      const result = await callHandler(makeEvent({ action: 'create' }));

      const parsed = JSON.parse(result as string);
      expect(parsed.success).toBe(false);
      expect(parsed.errorCode).toBe('VALIDATION_FAILED');
      expect(mockClient.models.GameSeason.create).not.toHaveBeenCalled();
    });
  });
});

describe('season-lifecycle handler — check action', () => {
  it('returns no-change when season is active and age is unchanged', async () => {
    mockClient.models.GameSeason.list.mockResolvedValue({
      data: [freshSeason()],
      errors: null,
    });

    const result = await callHandler(makeEvent({ action: 'check' }));

    const parsed = JSON.parse(result as string);
    expect(parsed.success).toBe(true);
    expect(parsed.processed[0].action).toBe('no_change');
    expect(mockClient.models.GameSeason.update).not.toHaveBeenCalled();
  });

  it('marks expired season as completed and expires open trade offers', async () => {
    const offerSellerId = 'seller-1';
    mockClient.models.GameSeason.list.mockResolvedValue({
      data: [expiredSeason()],
      errors: null,
    });
    mockClient.models.TradeOffer.list.mockResolvedValue({
      data: [{ id: 'offer-1', sellerId: offerSellerId, resourceType: 'gold', quantity: 100 }],
      errors: null,
    });
    mockClient.models.Kingdom.get.mockResolvedValue({
      data: { id: offerSellerId, resources: { gold: 0 } },
      errors: null,
    });

    const result = await callHandler(makeEvent({ action: 'check' }));

    const parsed = JSON.parse(result as string);
    expect(parsed.success).toBe(true);
    expect(parsed.processed[0].action).toBe('completed');

    // Season marked completed
    expect(mockClient.models.GameSeason.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'season-old', status: 'completed' })
    );
    // Trade offer expired
    expect(mockClient.models.TradeOffer.update).toHaveBeenCalledWith({ id: 'offer-1', status: 'expired' });
    // Seller refunded
    expect(mockClient.models.Kingdom.update).toHaveBeenCalled();
  });

  it('returns no active seasons message when none exist', async () => {
    mockClient.models.GameSeason.list.mockResolvedValue({ data: [], errors: null });

    const result = await callHandler(makeEvent({ action: 'check' }));

    const parsed = JSON.parse(result as string);
    expect(parsed.success).toBe(true);
    expect(parsed.message).toBe('No active seasons to process');
  });

  it('transitions age when enough time has passed', async () => {
    // Season started 3 weeks ago → weeksElapsed = 3, which is >= 2 but < 4, so 'middle' age
    const threeWeeksAgo = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString();
    const season = freshSeason({ startDate: threeWeeksAgo, currentAge: 'early' });
    mockClient.models.GameSeason.list.mockResolvedValue({ data: [season], errors: null });

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
    mockClient.models.GameSeason.get.mockResolvedValue({
      data: { id: 'season-2', status: 'active', seasonNumber: 2 },
      errors: null,
    });

    const result = await callHandler(makeEvent({ action: 'end', seasonId: 'season-2' }));

    const parsed = JSON.parse(result as string);
    expect(parsed.success).toBe(true);
    expect(parsed.action).toBe('force_ended');
    expect(parsed.seasonId).toBe('season-2');

    expect(mockClient.models.GameSeason.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'season-2', status: 'completed' })
    );
  });

  it('returns MISSING_PARAMS when seasonId is absent for end action', async () => {
    const result = await callHandler(makeEvent({ action: 'end' }));

    const parsed = JSON.parse(result as string);
    expect(parsed.success).toBe(false);
    expect(parsed.errorCode).toBe('MISSING_PARAMS');
  });

  it('returns NOT_FOUND when season does not exist', async () => {
    mockClient.models.GameSeason.get.mockResolvedValue({ data: null, errors: null });

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
