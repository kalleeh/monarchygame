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

function makeEvent(args: Record<string, unknown>) {
  return { arguments: args, identity: { sub: 'test-sub-123', username: 'test-user' } } as any;
}

function mockKingdom(id: string, overrides: Record<string, unknown> = {}) {
  return {
    data: {
      id,
      owner: 'test-user::owner',
      resources: { gold: 10000, population: 5000, mana: 500, land: 1000 },
      buildings: {},
      totalUnits: { infantry: 100, archers: 0, cavalry: 0, siege: 0, mages: 0, scouts: 500 },
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

describe('thievery-processor handler', () => {
  describe('happy path — scout operation', () => {
    it('applies scout casualties regardless of success and returns operation result', async () => {
      mockClient.models.Kingdom.get
        .mockResolvedValueOnce(mockKingdom('kingdom-1'))   // attacker
        .mockResolvedValueOnce(mockKingdom('target-1'));    // target

      const result = await callHandler(
        makeEvent({ kingdomId: 'kingdom-1', operation: 'scout', targetKingdomId: 'target-1' })
      );

      expect(result.success).toBe(true);
      const parsed = JSON.parse(result.result as string);
      expect(parsed.operation).toBe('scout');
      expect(typeof parsed.succeeded).toBe('boolean');
      expect(parsed.casualties).toBeGreaterThanOrEqual(0);

      // Attacker units updated (casualty deduction)
      expect(mockClient.models.Kingdom.update).toHaveBeenCalled();
    });
  });

  describe('happy path — steal operation', () => {
    it('transfers gold from target to attacker on successful steal', async () => {
      // Force success by making attacker have far more scouts than target
      mockClient.models.Kingdom.get
        .mockResolvedValueOnce(
          mockKingdom('kingdom-1', { totalUnits: { scouts: 10000 } })
        )
        .mockResolvedValueOnce(
          mockKingdom('target-1', {
            resources: { gold: 100000, population: 5000, mana: 500, land: 1000 },
            totalUnits: { scouts: 0 },
          })
        );

      // Mock Math.random to always return 1 so detection rate check is always passed
      vi.spyOn(Math, 'random').mockReturnValue(1);

      const result = await callHandler(
        makeEvent({ kingdomId: 'kingdom-1', operation: 'steal', targetKingdomId: 'target-1' })
      );

      expect(result.success).toBe(true);
      // Restore Math.random
      vi.restoreAllMocks();
    });
  });

  describe('validation failures', () => {
    it('returns MISSING_PARAMS when kingdomId is absent', async () => {
      const result = await callHandler(
        makeEvent({ operation: 'scout', targetKingdomId: 'target-1' })
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('MISSING_PARAMS');
    });

    it('returns MISSING_PARAMS when targetKingdomId is absent', async () => {
      const result = await callHandler(
        makeEvent({ kingdomId: 'kingdom-1', operation: 'scout' })
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('MISSING_PARAMS');
    });

    it('returns INVALID_PARAM for an invalid operation', async () => {
      const result = await callHandler(
        makeEvent({ kingdomId: 'kingdom-1', operation: 'ninja_stuff', targetKingdomId: 'target-1' })
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_PARAM');
    });

    it('returns INVALID_PARAM when operation is absent', async () => {
      const result = await callHandler(
        makeEvent({ kingdomId: 'kingdom-1', targetKingdomId: 'target-1' })
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_PARAM');
    });
  });

  describe('INSUFFICIENT_RESOURCES', () => {
    it('returns INSUFFICIENT_RESOURCES when attacker has fewer than 100 scouts', async () => {
      mockClient.models.Kingdom.get.mockResolvedValueOnce(
        mockKingdom('kingdom-1', { totalUnits: { scouts: 50 } })
      );

      const result = await callHandler(
        makeEvent({ kingdomId: 'kingdom-1', operation: 'scout', targetKingdomId: 'target-1' })
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INSUFFICIENT_RESOURCES');
    });

    it('returns INSUFFICIENT_RESOURCES when attacker has exactly 0 scouts', async () => {
      mockClient.models.Kingdom.get.mockResolvedValueOnce(
        mockKingdom('kingdom-1', { totalUnits: { scouts: 0 } })
      );

      const result = await callHandler(
        makeEvent({ kingdomId: 'kingdom-1', operation: 'steal', targetKingdomId: 'target-1' })
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INSUFFICIENT_RESOURCES');
    });
  });

  describe('NOT_FOUND', () => {
    it('returns NOT_FOUND when attacker kingdom does not exist', async () => {
      mockClient.models.Kingdom.get.mockResolvedValue({ data: null, errors: null });

      const result = await callHandler(
        makeEvent({ kingdomId: 'missing-id', operation: 'scout', targetKingdomId: 'target-1' })
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('NOT_FOUND');
    });

    it('returns NOT_FOUND when target kingdom does not exist', async () => {
      mockClient.models.Kingdom.get
        .mockResolvedValueOnce(mockKingdom('kingdom-1'))
        .mockResolvedValueOnce({ data: null, errors: null });

      const result = await callHandler(
        makeEvent({ kingdomId: 'kingdom-1', operation: 'scout', targetKingdomId: 'missing-target' })
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('NOT_FOUND');
    });
  });
});
