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
  newTurns?: number | null;
  resources?: string | null;
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

function mockKingdom(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      id: 'kingdom-1',
      owner: 'test-user::owner',
      resources: { gold: 10000, population: 1000, mana: 500, land: 1000 },
      buildings: { mine: 2, farm: 3, tower: 1, temple: 1, castle: 0, barracks: 0, wall: 0 },
      totalUnits: { infantry: 0, archers: 0, cavalry: 0, siege: 0, mages: 0, scouts: 200 },
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

describe('resource-manager handler', () => {
  describe('happy path', () => {
    it('calculates income from mines, farms, tower, base and tithe; updates resources', async () => {
      // 2 mines = 40/turn, 3 farms = 24/turn, 1 tower = 50/turn, base = 100/turn → 214 base
      // 1 temple, stats.tithe = 0 → titheMultiplier = 0, floored to 0.5 → tithePerTurn = floor(1*5*0.5) = 2
      // currentAge = undefined → 'early' → ageMultiplier = 1.0
      // totalGoldPerTurn = floor((214 + 2) * 1.0) = 216/turn
      // 3 farms → 30 pop/turn, 1 temple → 3 mana/turn
      mockClient.models.Kingdom.get.mockResolvedValue(mockKingdom());

      const result = await callHandler(makeEvent({ kingdomId: 'kingdom-1', turns: 1 }));

      expect(result.success).toBe(true);
      expect(result.newTurns).toBe(1);

      const updated = JSON.parse(result.resources as string);
      expect(updated.gold).toBe(10000 + 216);     // 10216
      expect(updated.population).toBe(1000 + 30); // 1030
      expect(updated.mana).toBe(500 + 3);          // 503
      expect(updated.land).toBe(1000);

      expect(mockClient.models.Kingdom.update).toHaveBeenCalledOnce();
    });

    it('multiplies income by turns', async () => {
      mockClient.models.Kingdom.get.mockResolvedValue(mockKingdom());

      const result = await callHandler(makeEvent({ kingdomId: 'kingdom-1', turns: 3 }));

      expect(result.success).toBe(true);
      expect(result.newTurns).toBe(3);

      const updated = JSON.parse(result.resources as string);
      expect(updated.gold).toBe(10000 + 216 * 3);
    });

    it('defaults to 1 turn when turns is not provided', async () => {
      mockClient.models.Kingdom.get.mockResolvedValue(mockKingdom());

      const result = await callHandler(makeEvent({ kingdomId: 'kingdom-1' }));

      expect(result.success).toBe(true);
      expect(result.newTurns).toBe(1);
    });

    it('tithe income scales with stats.tithe multiplier', async () => {
      // stats.tithe = 8 → titheMultiplier = 0.8, tithePerTurn = floor(2 * 5 * 0.8) = 8
      // baseGoldPerTurn = 0 mines + 0 farms + 0 towers + 100 base = 100
      // totalGoldPerTurn = floor((100 + 8) * 1.0) = 108
      mockClient.models.Kingdom.get.mockResolvedValue(mockKingdom({
        buildings: { mine: 0, farm: 0, tower: 0, temple: 2, castle: 0, barracks: 0, wall: 0 },
        stats: { tithe: 8 },
      }));

      const result = await callHandler(makeEvent({ kingdomId: 'kingdom-1', turns: 1 }));

      expect(result.success).toBe(true);
      const updated = JSON.parse(result.resources as string);
      expect(updated.gold).toBe(10000 + 108); // 10108
    });

    it('applies 15% income bonus in middle age', async () => {
      // 2 mines = 40, 3 farms = 24, 1 tower = 50, base = 100 → base 214
      // tithePerTurn = floor(1 * 5 * 0.5) = 2 → total before age = 216
      // ageMultiplier = 1.15 → totalGoldPerTurn = floor(216 * 1.15) = floor(248.4) = 248
      mockClient.models.Kingdom.get.mockResolvedValue(mockKingdom({ currentAge: 'middle' }));

      const result = await callHandler(makeEvent({ kingdomId: 'kingdom-1', turns: 1 }));

      expect(result.success).toBe(true);
      const updated = JSON.parse(result.resources as string);
      expect(updated.gold).toBe(10000 + 248); // 10248
    });

    it('applies 30% income bonus in late age', async () => {
      // totalGoldPerTurn = floor(216 * 1.30) = floor(280.8) = 280
      mockClient.models.Kingdom.get.mockResolvedValue(mockKingdom({ currentAge: 'late' }));

      const result = await callHandler(makeEvent({ kingdomId: 'kingdom-1', turns: 1 }));

      expect(result.success).toBe(true);
      const updated = JSON.parse(result.resources as string);
      expect(updated.gold).toBe(10000 + 280); // 10280
    });

    it('caps gold at the max limit (1000000)', async () => {
      mockClient.models.Kingdom.get.mockResolvedValue(
        mockKingdom({ resources: { gold: 999999, population: 0, mana: 0, land: 1000 } })
      );

      const result = await callHandler(makeEvent({ kingdomId: 'kingdom-1', turns: 100 }));

      expect(result.success).toBe(true);
      const updated = JSON.parse(result.resources as string);
      expect(updated.gold).toBe(1000000);
    });
  });

  describe('validation failures', () => {
    it('returns MISSING_PARAMS when kingdomId is absent', async () => {
      const result = await callHandler(makeEvent({}));

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('MISSING_PARAMS');
      expect(mockClient.models.Kingdom.get).not.toHaveBeenCalled();
    });

    it('returns INVALID_PARAM when kingdomId exceeds 128 characters', async () => {
      const result = await callHandler(makeEvent({ kingdomId: 'x'.repeat(129) }));

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_PARAM');
    });
  });

  describe('NOT_FOUND', () => {
    it('returns NOT_FOUND when kingdom does not exist', async () => {
      mockClient.models.Kingdom.get.mockResolvedValue({ data: null, errors: null });

      const result = await callHandler(makeEvent({ kingdomId: 'missing-id' }));

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('NOT_FOUND');
    });
  });

  describe('internal error handling', () => {
    it('returns INTERNAL_ERROR on unexpected exception', async () => {
      mockClient.models.Kingdom.get.mockRejectedValue(new Error('DynamoDB timeout'));

      const result = await callHandler(makeEvent({ kingdomId: 'kingdom-1' }));

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INTERNAL_ERROR');
    });
  });
});
