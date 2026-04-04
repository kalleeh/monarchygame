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
}));

vi.mock('../rate-limiter', () => ({ checkRateLimit: vi.fn().mockResolvedValue(null) }));

import { handler } from './handler';

// ---------------------------------------------------------------------------
// Type helpers
// ---------------------------------------------------------------------------

interface HandlerResult {
  success: boolean;
  units?: string | null;
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
    id: 'kingdom-1',
    owner: 'test-sub-123',
    resources: { gold: 10000, population: 1000, mana: 500, land: 1000 },
    buildings: { mine: 0, farm: 0, tower: 0, temple: 0, castle: 0, barracks: 0, wall: 0 },
    totalUnits: { infantry: 0, archers: 0, cavalry: 0, siege: 0, mages: 0, scouts: 200 },
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

describe('unit-trainer handler', () => {
  describe('happy path', () => {
    it('deducts 100 gold per unit and increments unit count', async () => {
      mockDbGet.mockResolvedValue(mockKingdom());

      const result = await callHandler(makeEvent({ kingdomId: 'kingdom-1', unitType: 'infantry', quantity: 5, goldCost: 100 }));

      expect(result.success).toBe(true);
      const units = JSON.parse(result.units as string);
      expect(units.infantry).toBe(5);

      // 5 * 100 = 500 gold deducted
      const updateCall = mockDbUpdate.mock.calls[0];
      expect(updateCall[2].resources.gold).toBe(10000 - 500);
    });

    it('works for every valid unit type', async () => {
      const types = ['infantry', 'archers', 'cavalry', 'siege', 'mages', 'scouts'];
      for (const unitType of types) {
        vi.clearAllMocks();
        mockDbGet.mockResolvedValue(mockKingdom());
        mockDbUpdate.mockResolvedValue(undefined);

        const result = await callHandler(makeEvent({ kingdomId: 'kingdom-1', unitType, quantity: 1 }));

        expect(result.success).toBe(true);
        const units = JSON.parse(result.units as string);
        // scouts starts at 200; others start at 0
        expect(units[unitType]).toBeGreaterThanOrEqual(1);
      }
    });

    it('adds to existing unit count', async () => {
      mockDbGet.mockResolvedValue(
        mockKingdom({ totalUnits: { infantry: 50, archers: 0, cavalry: 0, siege: 0, mages: 0, scouts: 200 } })
      );

      const result = await callHandler(makeEvent({ kingdomId: 'kingdom-1', unitType: 'infantry', quantity: 10 }));

      expect(result.success).toBe(true);
      const units = JSON.parse(result.units as string);
      expect(units.infantry).toBe(60);
    });
  });

  describe('validation failures', () => {
    it('returns MISSING_PARAMS when kingdomId is absent', async () => {
      const result = await callHandler(makeEvent({ unitType: 'infantry', quantity: 1 }));

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('MISSING_PARAMS');
    });

    it('returns MISSING_PARAMS when unitType is absent', async () => {
      const result = await callHandler(makeEvent({ kingdomId: 'kingdom-1', quantity: 1 }));

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('MISSING_PARAMS');
    });

    it('returns MISSING_PARAMS when quantity is absent', async () => {
      const result = await callHandler(makeEvent({ kingdomId: 'kingdom-1', unitType: 'infantry' }));

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('MISSING_PARAMS');
    });

    it('accepts custom unit types (race-specific units allowed by design)', async () => {
      // The handler accepts any non-empty unitType string — the frontend
      // is responsible for validating race-specific unit lists.
      mockDbGet.mockResolvedValue(mockKingdom());
      const result = await callHandler(makeEvent({ kingdomId: 'kingdom-1', unitType: 'dragon', quantity: 1 }));

      expect(result.success).toBe(true);
    });

    it('returns INVALID_PARAM when quantity is 0', async () => {
      const result = await callHandler(makeEvent({ kingdomId: 'kingdom-1', unitType: 'infantry', quantity: 0 }));

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_PARAM');
    });

    it('returns INVALID_PARAM when quantity exceeds 1000', async () => {
      const result = await callHandler(makeEvent({ kingdomId: 'kingdom-1', unitType: 'infantry', quantity: 1001 }));

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_PARAM');
    });
  });

  describe('NOT_FOUND', () => {
    it('returns NOT_FOUND when kingdom does not exist', async () => {
      mockDbGet.mockResolvedValue(null);

      const result = await callHandler(makeEvent({ kingdomId: 'missing-id', unitType: 'infantry', quantity: 1 }));

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('NOT_FOUND');
    });
  });

  describe('INSUFFICIENT_RESOURCES', () => {
    it('returns INSUFFICIENT_RESOURCES when gold is below cost', async () => {
      // 20 infantry at 100 gold each = 2000 gold, but kingdom has only 1500
      mockDbGet.mockResolvedValue(
        mockKingdom({ resources: { gold: 1500, population: 1000, mana: 500, land: 1000 } })
      );

      const result = await callHandler(makeEvent({ kingdomId: 'kingdom-1', unitType: 'infantry', quantity: 20, goldCost: 100 }));

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INSUFFICIENT_RESOURCES');
      expect(mockDbUpdate).not.toHaveBeenCalled();
    });
  });
});
