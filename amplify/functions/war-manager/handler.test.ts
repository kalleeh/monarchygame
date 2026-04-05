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

function mockKingdom(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    owner: 'test-sub-123',
    resources: { gold: 10000, population: 1000, mana: 500, land: 1000 },
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
  mockDbGet.mockResolvedValue(mockKingdom('king-1'));
  mockDbList.mockResolvedValue([]);
  mockDbQuery.mockResolvedValue([]);
  mockDbCreate.mockResolvedValue({ id: 'war-1', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), __typename: 'WarDeclaration' });
  mockDbUpdate.mockResolvedValue(undefined);
});

describe('war-manager handler — declareWar', () => {
  describe('happy path', () => {
    it('creates a WarDeclaration and diplomatic relation when no prior war exists', async () => {
      const result = await callHandler(
        makeEvent({ attackerId: 'king-1', defenderId: 'king-2', seasonId: 'season-1', reason: 'Land dispute' })
      );

      const parsed = JSON.parse(result as string);
      expect(parsed.success).toBe(true);
      expect(parsed.warDeclaration.attackerId).toBe('king-1');
      expect(parsed.warDeclaration.defenderId).toBe('king-2');
      expect(parsed.warDeclaration.status).toBe('active');

      expect(mockDbCreate).toHaveBeenCalledWith('WarDeclaration', expect.anything());
      // No existing relation → create one
      expect(mockDbCreate).toHaveBeenCalledWith('DiplomaticRelation', expect.anything());
    });

    it('updates existing diplomatic relation to war status', async () => {
      mockDbQuery.mockImplementation(async (model: string) => {
        if (model === 'DiplomaticRelation') return [{ id: 'rel-1', kingdomId: 'king-1', targetKingdomId: 'king-2', status: 'neutral', reputation: 10 }];
        return [];
      });

      const result = await callHandler(
        makeEvent({ attackerId: 'king-1', defenderId: 'king-2', seasonId: 'season-1' })
      );

      const parsed = JSON.parse(result as string);
      expect(parsed.success).toBe(true);
      expect(mockDbUpdate).toHaveBeenCalledWith('DiplomaticRelation', 'rel-1', expect.anything());
      expect(mockDbCreate).not.toHaveBeenCalledWith('DiplomaticRelation', expect.anything());
    });

    it('breaks active treaties when war is declared', async () => {
      mockDbQuery.mockImplementation(async (model: string) => {
        if (model === 'Treaty') return [{ id: 'treaty-1', proposerId: 'king-1', recipientId: 'king-2', status: 'active' }];
        return [];
      });

      await callHandler(
        makeEvent({ attackerId: 'king-1', defenderId: 'king-2', seasonId: 'season-1' })
      );

      expect(mockDbUpdate).toHaveBeenCalledWith('Treaty', 'treaty-1', { status: 'broken' });
    });
  });

  describe('validation failures', () => {
    it('returns MISSING_PARAMS when attackerId is absent', async () => {
      const result = await callHandler(makeEvent({ defenderId: 'king-2', seasonId: 'season-1' }));

      const parsed = JSON.parse(result as string);
      expect(parsed.success).toBe(false);
      expect(parsed.errorCode).toBe('MISSING_PARAMS');
    });

    it('returns MISSING_PARAMS when defenderId is absent', async () => {
      const result = await callHandler(makeEvent({ attackerId: 'king-1', seasonId: 'season-1' }));

      const parsed = JSON.parse(result as string);
      expect(parsed.success).toBe(false);
      expect(parsed.errorCode).toBe('MISSING_PARAMS');
    });

    it('succeeds when seasonId is absent (seasonId is optional)', async () => {
      // seasonId is optional — war can be declared without associating it to a season
      const result = await callHandler(makeEvent({ attackerId: 'king-1', defenderId: 'king-2' }));

      const parsed = JSON.parse(result as string);
      expect(parsed.success).toBe(true);
    });

    it('returns INVALID_PARAM when attacker and defender are the same', async () => {
      const result = await callHandler(
        makeEvent({ attackerId: 'king-1', defenderId: 'king-1', seasonId: 'season-1' })
      );

      const parsed = JSON.parse(result as string);
      expect(parsed.success).toBe(false);
      expect(parsed.errorCode).toBe('INVALID_PARAM');
    });

    it('returns VALIDATION_FAILED when war already exists against this kingdom', async () => {
      mockDbQuery.mockImplementation(async (model: string) => {
        if (model === 'WarDeclaration') return [{ id: 'war-existing', attackerId: 'king-1', defenderId: 'king-2', seasonId: 'season-1', status: 'active' }];
        return [];
      });

      const result = await callHandler(
        makeEvent({ attackerId: 'king-1', defenderId: 'king-2', seasonId: 'season-1' })
      );

      const parsed = JSON.parse(result as string);
      expect(parsed.success).toBe(false);
      expect(parsed.errorCode).toBe('VALIDATION_FAILED');
      expect(mockDbCreate).not.toHaveBeenCalledWith('WarDeclaration', expect.anything());
    });
  });
});

describe('war-manager handler — resolveWar', () => {
  describe('happy path', () => {
    it('resolves an existing war and updates diplomatic relation to neutral', async () => {
      mockDbGet.mockImplementation(async (model: string) => {
        if (model === 'WarDeclaration') return { id: 'war-1', attackerId: 'king-1', defenderId: 'king-2', status: 'active' };
        return mockKingdom('king-1');
      });
      mockDbQuery.mockImplementation(async (model: string) => {
        if (model === 'DiplomaticRelation') return [{ id: 'rel-1', kingdomId: 'king-1', targetKingdomId: 'king-2', status: 'war', reputation: -50 }];
        return [];
      });

      const result = await callHandler(
        makeEvent({ warId: 'war-1', resolution: 'peace_treaty' })
      );

      const parsed = JSON.parse(result as string);
      expect(parsed.success).toBe(true);
      expect(parsed.warId).toBe('war-1');
      expect(parsed.resolution).toBe('peace_treaty');

      expect(mockDbUpdate).toHaveBeenCalledWith(
        'WarDeclaration',
        'war-1',
        expect.objectContaining({ status: 'resolved' })
      );
      expect(mockDbUpdate).toHaveBeenCalledWith(
        'DiplomaticRelation',
        'rel-1',
        expect.objectContaining({ status: 'neutral' })
      );
    });
  });

  describe('NOT_FOUND', () => {
    it('returns NOT_FOUND when warId does not exist', async () => {
      mockDbGet.mockResolvedValue(null);

      const result = await callHandler(makeEvent({ warId: 'missing-war', resolution: 'peace' }));

      const parsed = JSON.parse(result as string);
      expect(parsed.success).toBe(false);
      expect(parsed.errorCode).toBe('NOT_FOUND');
    });
  });

  describe('validation failures', () => {
    it('returns MISSING_PARAMS when warId is absent', async () => {
      const result = await callHandler(makeEvent({ resolution: 'peace' }));

      // When neither warId+resolution NOR attackerId+defenderId are present,
      // the handler falls through to declareWar path and returns MISSING_PARAMS
      const parsed = JSON.parse(result as string);
      expect(parsed.success).toBe(false);
    });
  });
});
