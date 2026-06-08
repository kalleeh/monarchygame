import { vi, describe, it, expect, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock ../data-client before importing the handler
// ---------------------------------------------------------------------------

const mockDbGet = vi.hoisted(() => vi.fn());
const mockDbUpdate = vi.hoisted(() => vi.fn());
const mockDbConditionalUpdate = vi.hoisted(() => vi.fn());
const mockDbCreate = vi.hoisted(() => vi.fn());
const mockDbList = vi.hoisted(() => vi.fn());
const mockDbDelete = vi.hoisted(() => vi.fn());
const mockDbAtomicAdd = vi.hoisted(() => vi.fn());
const mockDbQuery = vi.hoisted(() => vi.fn());

vi.mock('../data-client', () => ({
  persistErrorLog: vi.fn().mockResolvedValue(undefined),
  dbGet: mockDbGet,
  dbUpdate: mockDbUpdate,
  dbConditionalUpdate: mockDbConditionalUpdate,
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

// Mock unit-costs to avoid pulling in the full shared-races dependency tree.
// Returns deterministic costs that tests can rely on.
vi.mock('../../../shared/mechanics/unit-costs', () => ({
  getUnitGoldCost: (race: string, unitType: string): number | null => {
    if (race !== 'Human') return null;
    const costs: Record<string, number> = {
      peasants: 50, militia: 350, knights: 900, cavalry: 2000, scouts: 200,
    };
    return costs[unitType] ?? null;
  },
}));

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
  mockDbConditionalUpdate.mockResolvedValue(undefined);
  mockDbList.mockResolvedValue([]);
  mockDbQuery.mockResolvedValue([]);
});

describe('unit-trainer handler', () => {
  describe('happy path', () => {
    it('deducts server-computed gold per unit and increments unit count', async () => {
      mockDbGet.mockResolvedValue(mockKingdom());

      const result = await callHandler(makeEvent({ kingdomId: 'kingdom-1', unitType: 'militia', quantity: 5 }));

      expect(result.success).toBe(true);
      const units = JSON.parse(result.units as string);
      expect(units.militia).toBe(5);

      // 5 * 350 (server-computed Human militia cost) = 1750 gold deducted
      const updateCall = mockDbConditionalUpdate.mock.calls[0];
      expect(updateCall[2].resources.gold).toBe(10000 - 1750);
    });

    it('works for every valid unit type', async () => {
      const types = ['peasants', 'militia', 'knights', 'cavalry', 'scouts'];
      for (const unitType of types) {
        vi.clearAllMocks();
        mockDbGet.mockResolvedValue(mockKingdom());
        mockDbConditionalUpdate.mockResolvedValue(undefined);

        const result = await callHandler(makeEvent({ kingdomId: 'kingdom-1', unitType, quantity: 1 }));

        expect(result.success).toBe(true);
        const units = JSON.parse(result.units as string);
        // scouts starts at 200; others start at 0
        expect(units[unitType]).toBeGreaterThanOrEqual(1);
      }
    });

    it('adds to existing unit count', async () => {
      mockDbGet.mockResolvedValue(
        mockKingdom({ totalUnits: { militia: 50, archers: 0, cavalry: 0, siege: 0, mages: 0, scouts: 200 } })
      );

      const result = await callHandler(makeEvent({ kingdomId: 'kingdom-1', unitType: 'militia', quantity: 10 }));

      expect(result.success).toBe(true);
      const units = JSON.parse(result.units as string);
      expect(units.militia).toBe(60);
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

    it('rejects unknown unit types for the kingdom race', async () => {
      // Server-side cost lookup rejects unit types that don't exist for the race
      mockDbGet.mockResolvedValue(mockKingdom());
      const result = await callHandler(makeEvent({ kingdomId: 'kingdom-1', unitType: 'dragon', quantity: 1 }));

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_PARAM');
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
      // 20 militia at 350 gold each (server-computed) = 7000 gold, but kingdom has only 1500
      mockDbGet.mockResolvedValue(
        mockKingdom({ resources: { gold: 1500, population: 1000, mana: 500, land: 1000 } })
      );

      const result = await callHandler(makeEvent({ kingdomId: 'kingdom-1', unitType: 'militia', quantity: 20 }));

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INSUFFICIENT_RESOURCES');
      expect(mockDbConditionalUpdate).not.toHaveBeenCalled();
    });
  });

  describe('troop cap (gold invested in troops)', () => {
    it('rejects training that would exceed the land+barracks-scaled cap', async () => {
      // land 1000, barracks 0 -> cap floored at 2,000,000g.
      // 6000 existing militia × 350g = 2,100,000g, already over cap.
      mockDbGet.mockResolvedValue(
        mockKingdom({
          resources: { gold: 100000, population: 100000, mana: 0, land: 1000 },
          totalUnits: { militia: 6000, infantry: 0, archers: 0, cavalry: 0, siege: 0, mages: 0, scouts: 0 },
        })
      );

      const result = await callHandler(makeEvent({ kingdomId: 'kingdom-1', unitType: 'militia', quantity: 1 }));
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('VALIDATION_FAILED');
      expect(result.error).toMatch(/troop cap/i);
      expect(mockDbConditionalUpdate).not.toHaveBeenCalled();
    });

    it('allows training comfortably under the cap', async () => {
      // 100 militia = 35,000g invested vs 2M cap — fine.
      mockDbGet.mockResolvedValue(
        mockKingdom({
          resources: { gold: 100000, population: 100000, mana: 0, land: 1000 },
          totalUnits: { militia: 100, infantry: 0, archers: 0, cavalry: 0, siege: 0, mages: 0, scouts: 0 },
        })
      );

      const result = await callHandler(makeEvent({ kingdomId: 'kingdom-1', unitType: 'militia', quantity: 1 }));
      expect(result.success).toBe(true);
    });

    it('raises the cap when the kingdom has more land + barracks', async () => {
      // land 30000 × 1000 + 5000 barracks × 2000 = 40M cap — 2.1M of troops fits easily.
      mockDbGet.mockResolvedValue(
        mockKingdom({
          resources: { gold: 100000, population: 100000, mana: 0, land: 30000 },
          buildings: { mine: 0, farm: 0, tower: 0, temple: 0, castle: 0, barracks: 5000, wall: 0 },
          totalUnits: { militia: 6000, infantry: 0, archers: 0, cavalry: 0, siege: 0, mages: 0, scouts: 0 },
        })
      );

      const result = await callHandler(makeEvent({ kingdomId: 'kingdom-1', unitType: 'militia', quantity: 1 }));
      expect(result.success).toBe(true);
    });
  });
});
