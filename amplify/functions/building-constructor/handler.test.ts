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

import { handler } from './handler';

// ---------------------------------------------------------------------------
// Type helpers
// ---------------------------------------------------------------------------

interface HandlerResult {
  success: boolean;
  buildings?: string | null;
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

describe('building-constructor handler', () => {
  describe('happy path', () => {
    it('deducts 250 gold per building and increments building count', async () => {
      mockDbGet.mockResolvedValue(mockKingdom());

      const result = await callHandler(makeEvent({ kingdomId: 'kingdom-1', buildingType: 'mine', quantity: 2 }));

      expect(result.success).toBe(true);
      const buildings = JSON.parse(result.buildings as string);
      expect(buildings.mine).toBe(2);

      // Verify update called with correct resource deduction (2 * 250 = 500)
      const updateCall = mockDbConditionalUpdate.mock.calls[0];
      expect(updateCall[2].resources.gold).toBe(10000 - 500);
    });

    it('works for every valid building type', async () => {
      const types = ['castle', 'barracks', 'farm', 'mine', 'temple', 'tower', 'wall'];
      for (const buildingType of types) {
        vi.clearAllMocks();
        mockDbGet.mockResolvedValue(mockKingdom());
        mockDbUpdate.mockResolvedValue(undefined);

        const result = await callHandler(makeEvent({ kingdomId: 'kingdom-1', buildingType, quantity: 1 }));

        expect(result.success).toBe(true);
        const buildings = JSON.parse(result.buildings as string);
        expect(buildings[buildingType]).toBe(1);
      }
    });

    it('adds to existing building count', async () => {
      mockDbGet.mockResolvedValue(
        mockKingdom({ buildings: { mine: 5, farm: 0, tower: 0, temple: 0, castle: 0, barracks: 0, wall: 0 } })
      );

      const result = await callHandler(makeEvent({ kingdomId: 'kingdom-1', buildingType: 'mine', quantity: 3 }));

      expect(result.success).toBe(true);
      const buildings = JSON.parse(result.buildings as string);
      expect(buildings.mine).toBe(8);
    });
  });

  describe('validation failures', () => {
    it('returns MISSING_PARAMS when kingdomId is absent', async () => {
      const result = await callHandler(makeEvent({ buildingType: 'mine', quantity: 1 }));

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('MISSING_PARAMS');
      expect(mockDbGet).not.toHaveBeenCalled();
    });

    it('returns MISSING_PARAMS when buildingType is absent', async () => {
      const result = await callHandler(makeEvent({ kingdomId: 'kingdom-1', quantity: 1 }));

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('MISSING_PARAMS');
    });

    it('returns MISSING_PARAMS when quantity is absent', async () => {
      const result = await callHandler(makeEvent({ kingdomId: 'kingdom-1', buildingType: 'mine' }));

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('MISSING_PARAMS');
    });

    it('returns INVALID_PARAM for an unrecognised building type', async () => {
      const result = await callHandler(makeEvent({ kingdomId: 'kingdom-1', buildingType: 'dungeon', quantity: 1 }));

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_PARAM');
    });

    it('returns INVALID_PARAM when quantity is 0', async () => {
      const result = await callHandler(makeEvent({ kingdomId: 'kingdom-1', buildingType: 'mine', quantity: 0 }));

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_PARAM');
    });

    it('returns INVALID_PARAM when quantity exceeds 1000', async () => {
      const result = await callHandler(makeEvent({ kingdomId: 'kingdom-1', buildingType: 'mine', quantity: 1001 }));

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_PARAM');
    });

    it('returns INVALID_PARAM when quantity is a float', async () => {
      const result = await callHandler(makeEvent({ kingdomId: 'kingdom-1', buildingType: 'mine', quantity: 1.5 }));

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_PARAM');
    });
  });

  describe('NOT_FOUND', () => {
    it('returns NOT_FOUND when kingdom does not exist', async () => {
      mockDbGet.mockResolvedValue(null);

      const result = await callHandler(makeEvent({ kingdomId: 'missing-id', buildingType: 'mine', quantity: 1 }));

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('NOT_FOUND');
    });
  });

  describe('INSUFFICIENT_RESOURCES', () => {
    it('returns INSUFFICIENT_RESOURCES when gold is below cost', async () => {
      // 3 mines = 750 gold cost, but kingdom only has 500 gold
      mockDbGet.mockResolvedValue(
        mockKingdom({ resources: { gold: 500, population: 1000, mana: 500, land: 1000 } })
      );

      const result = await callHandler(makeEvent({ kingdomId: 'kingdom-1', buildingType: 'mine', quantity: 3 }));

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INSUFFICIENT_RESOURCES');
      expect(mockDbUpdate).not.toHaveBeenCalled();
      expect(mockDbConditionalUpdate).not.toHaveBeenCalled();
    });

    it('succeeds when gold is exactly equal to cost', async () => {
      // 1 mine = 250 gold cost, kingdom has exactly 250 gold
      mockDbGet.mockResolvedValue(
        mockKingdom({ resources: { gold: 250, population: 1000, mana: 500, land: 1000 } })
      );

      const result = await callHandler(makeEvent({ kingdomId: 'kingdom-1', buildingType: 'mine', quantity: 1 }));

      expect(result.success).toBe(true);
      const updateCall = mockDbConditionalUpdate.mock.calls[0];
      expect(updateCall[2].resources.gold).toBe(0);
    });
  });
});
