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
  territory?: string | null;
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
  mockDbCreate.mockResolvedValue({ id: 'territory-1', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), __typename: 'Territory' });
  // Some handlers also call dbList for RestorationStatus or other checks - keep [] as default
});

describe('territory-claimer handler', () => {
  describe('happy path', () => {
    it('creates a territory and deducts 500 gold', async () => {
      mockDbGet.mockResolvedValue(mockKingdom());

      const result = await callHandler(
        makeEvent({ kingdomId: 'kingdom-1', territoryName: 'Forest Keep', territoryType: 'settlement', terrainType: 'forest', coordinates: { x: 10, y: 20 } })
      );

      expect(result.success).toBe(true);
      expect(result.territory).toBe('Forest Keep');

      // Gold deduction
      const resourcesCall = mockDbUpdate.mock.calls.find((c: unknown[]) => c[0] === 'Kingdom' && (c[2] as Record<string, unknown>).resources);
      expect(resourcesCall).toBeDefined();
      expect((resourcesCall![2] as Record<string, unknown>).resources).toMatchObject({ gold: 10000 - 500 });
      // Pending settlement stored in stats
      const statsCall = mockDbUpdate.mock.calls.find((c: unknown[]) => c[0] === 'Kingdom' && (c[2] as Record<string, unknown>).stats);
      expect(statsCall).toBeDefined();
      const stats = JSON.parse((statsCall![2] as Record<string, unknown>).stats as string);
      expect(stats.pendingSettlements).toHaveLength(1);
      expect(stats.pendingSettlements[0].name).toBe('Forest Keep');
    });

    it('uses default values for territoryType and terrainType when omitted', async () => {
      mockDbGet.mockResolvedValue(mockKingdom());

      const result = await callHandler(
        makeEvent({ kingdomId: 'kingdom-1', territoryName: 'My Land' })
      );

      expect(result.success).toBe(true);
      // Territory queued as pending settlement in stats
      const statsCall = mockDbUpdate.mock.calls.find((c: unknown[]) => c[0] === 'Kingdom' && (c[2] as Record<string, unknown>).stats);
      expect(statsCall).toBeDefined();
      const stats = JSON.parse((statsCall![2] as Record<string, unknown>).stats as string);
      expect(stats.pendingSettlements[0].type).toBe('settlement');
      expect(stats.pendingSettlements[0].terrainType).toBe('plains');
    });
  });

  describe('validation failures', () => {
    it('returns MISSING_PARAMS when kingdomId is absent', async () => {
      const result = await callHandler(makeEvent({ territoryName: 'Forest Keep' }));

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('MISSING_PARAMS');
    });

    it('returns MISSING_PARAMS when territoryName is absent', async () => {
      const result = await callHandler(makeEvent({ kingdomId: 'kingdom-1' }));

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('MISSING_PARAMS');
    });

    it('returns INVALID_PARAM when territoryName is too short (< 2 chars)', async () => {
      const result = await callHandler(
        makeEvent({ kingdomId: 'kingdom-1', territoryName: 'X' })
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_PARAM');
    });

    it('returns INVALID_PARAM when territoryName exceeds 50 chars', async () => {
      const result = await callHandler(
        makeEvent({ kingdomId: 'kingdom-1', territoryName: 'A'.repeat(51) })
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_PARAM');
    });

    it('returns INVALID_PARAM when coordinates are out of range', async () => {
      const result = await callHandler(
        makeEvent({ kingdomId: 'kingdom-1', territoryName: 'Far Lands', coordinates: { x: 99999, y: 0 } })
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_PARAM');
    });

    it('returns INVALID_PARAM when territory already claimed at these coordinates', async () => {
      mockDbGet.mockResolvedValue(mockKingdom());
      // Handler uses dbQuery with kingdomId GSI for Territory
      mockDbQuery.mockImplementation(async (model: string) => {
        if (model === 'Territory') return [{ id: 'existing', kingdomId: 'kingdom-1', coordinates: JSON.stringify({ x: 5, y: 5 }) }];
        return [];
      });

      const result = await callHandler(
        makeEvent({ kingdomId: 'kingdom-1', territoryName: 'Overlap', coordinates: { x: 5, y: 5 } })
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_PARAM');
    });
  });

  describe('NOT_FOUND', () => {
    it('returns NOT_FOUND when kingdom does not exist', async () => {
      mockDbGet.mockResolvedValue(null);

      const result = await callHandler(
        makeEvent({ kingdomId: 'missing-id', territoryName: 'Forest Keep' })
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('NOT_FOUND');
    });
  });

  describe('INSUFFICIENT_RESOURCES', () => {
    it('returns INSUFFICIENT_RESOURCES when gold is below 500', async () => {
      mockDbGet.mockResolvedValue(
        mockKingdom({ resources: { gold: 400, population: 1000, mana: 500, land: 1000 } })
      );

      const result = await callHandler(
        makeEvent({ kingdomId: 'kingdom-1', territoryName: 'Poor Fort' })
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INSUFFICIENT_RESOURCES');
      expect(mockDbCreate).not.toHaveBeenCalled();
    });
  });
});
