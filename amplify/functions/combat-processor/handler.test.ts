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

import { handler } from './handler';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface HandlerResult {
  success: boolean;
  result?: string | null;
  error?: string | null;
  errorCode?: string | null;
}

// Cast handler to a simple single-argument callable so tests are not burdened
// by the Amplify Gen2 / AWS Lambda 3-argument (event, context, callback)
// signature that Schema["processCombat"]["functionHandler"] enforces, and so
// that the return type is narrowed to HandlerResult rather than the loose
// JSON union (string | number | boolean | {} | any[] | null) produced by
// .returns(a.json()).
const callHandler = handler as unknown as (event: unknown) => Promise<HandlerResult>;

function makeEvent(args: Record<string, unknown>) {
  return { arguments: args, identity: { sub: 'test-sub-123', username: 'test-user' } } as any;
}

function mockKingdom(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    owner: 'test-sub-123',
    resources: { gold: 50000, population: 5000, mana: 500, land: 10000 },
    buildings: { mine: 5, farm: 5, tower: 2, temple: 1, castle: 1, barracks: 2, wall: 3 },
    totalUnits: { infantry: 1000, archers: 500, cavalry: 200, siege: 50, mages: 100, scouts: 300 },
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
  mockDbCreate.mockResolvedValue({ id: 'battle-1', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), __typename: 'BattleReport' });
  mockDbList.mockResolvedValue([]);
  mockDbQuery.mockResolvedValue([]);
});

describe('combat-processor handler', () => {
  describe('happy path', () => {
    it('processes combat, creates a BattleReport, and updates both kingdoms', async () => {
      // Attacker has overwhelming cavalry advantage — combat should succeed
      const attackerKingdom = mockKingdom('attacker-1', {
        totalUnits: { infantry: 0, archers: 0, cavalry: 5000, siege: 0, mages: 0, scouts: 100 },
      });
      const defenderKingdom = mockKingdom('defender-1', {
        totalUnits: { infantry: 10, archers: 0, cavalry: 0, siege: 0, mages: 0, scouts: 0 },
        resources: { gold: 10000, population: 1000, mana: 100, land: 5000 },
      });

      mockDbGet
        .mockResolvedValueOnce(attackerKingdom)
        .mockResolvedValueOnce(defenderKingdom);

      const result = await callHandler(
        makeEvent({
          attackerId: 'attacker-1',
          defenderId: 'defender-1',
          attackType: 'standard',
          units: JSON.stringify({ cavalry: 5000 }),
        })
      );

      expect(result.success).toBe(true);
      expect(mockDbCreate).toHaveBeenCalledOnce();
      expect(mockDbUpdate).toHaveBeenCalled();

      const parsed = JSON.parse(result.result as string);
      expect(parsed).toHaveProperty('result');
      expect(parsed).toHaveProperty('landGained');
      expect(parsed).toHaveProperty('goldLooted');
    });

    it('applies aggressive formation bonus (+15%) and still processes combat', async () => {
      const attackerKingdom = mockKingdom('attacker-1', {
        totalUnits: { cavalry: 5000 },
      });
      const defenderKingdom = mockKingdom('defender-1', {
        totalUnits: { infantry: 10 },
        resources: { gold: 10000, population: 1000, mana: 100, land: 5000 },
      });

      mockDbGet
        .mockResolvedValueOnce(attackerKingdom)
        .mockResolvedValueOnce(defenderKingdom);

      const result = await callHandler(
        makeEvent({
          attackerId: 'attacker-1',
          defenderId: 'defender-1',
          attackType: 'standard',
          units: JSON.stringify({ cavalry: 5000 }),
          formationId: 'aggressive',
        })
      );

      expect(result.success).toBe(true);
      const parsed = JSON.parse(result.result as string);
      expect(parsed).toHaveProperty('result');
      expect(parsed).toHaveProperty('landGained');
    });

    it('applies siege formation bonus (+20%) and still processes combat', async () => {
      const attackerKingdom = mockKingdom('attacker-1', {
        totalUnits: { cavalry: 5000 },
      });
      const defenderKingdom = mockKingdom('defender-1', {
        totalUnits: { infantry: 10 },
        resources: { gold: 10000, population: 1000, mana: 100, land: 5000 },
      });

      mockDbGet
        .mockResolvedValueOnce(attackerKingdom)
        .mockResolvedValueOnce(defenderKingdom);

      const result = await callHandler(
        makeEvent({
          attackerId: 'attacker-1',
          defenderId: 'defender-1',
          attackType: 'standard',
          units: JSON.stringify({ cavalry: 5000 }),
          formationId: 'siege',
        })
      );

      expect(result.success).toBe(true);
      const parsed = JSON.parse(result.result as string);
      expect(parsed).toHaveProperty('result');
    });

    it('applies standard formation (1.0x) with no change to combat result', async () => {
      const attackerKingdom = mockKingdom('attacker-1', {
        totalUnits: { cavalry: 5000 },
      });
      const defenderKingdom = mockKingdom('defender-1', {
        totalUnits: { infantry: 10 },
        resources: { gold: 10000, population: 1000, mana: 100, land: 5000 },
      });

      mockDbGet
        .mockResolvedValueOnce(attackerKingdom)
        .mockResolvedValueOnce(defenderKingdom);

      const result = await callHandler(
        makeEvent({
          attackerId: 'attacker-1',
          defenderId: 'defender-1',
          attackType: 'standard',
          units: JSON.stringify({ cavalry: 5000 }),
          formationId: 'standard',
        })
      );

      expect(result.success).toBe(true);
      const parsed = JSON.parse(result.result as string);
      expect(parsed).toHaveProperty('result');
    });

    it('still deducts casualties even when combat fails', async () => {
      // Attacker is weak — combat fails
      const weakAttacker = mockKingdom('attacker-1', {
        totalUnits: { infantry: 1, archers: 0, cavalry: 0, siege: 0, mages: 0, scouts: 0 },
      });
      const strongDefender = mockKingdom('defender-1', {
        totalUnits: { infantry: 10000, archers: 5000, cavalry: 2000, siege: 500, mages: 1000, scouts: 300 },
      });

      mockDbGet
        .mockResolvedValueOnce(weakAttacker)
        .mockResolvedValueOnce(strongDefender);

      const result = await callHandler(
        makeEvent({
          attackerId: 'attacker-1',
          defenderId: 'defender-1',
          attackType: 'standard',
          units: JSON.stringify({ infantry: 1 }),
        })
      );

      expect(result.success).toBe(true);
      // Kingdom updates still happen (casualty deduction)
      expect(mockDbUpdate).toHaveBeenCalled();
    });

    it('accepts units as a parsed object (not a JSON string)', async () => {
      const attackerKingdom = mockKingdom('attacker-1');
      const defenderKingdom = mockKingdom('defender-1');

      mockDbGet
        .mockResolvedValueOnce(attackerKingdom)
        .mockResolvedValueOnce(defenderKingdom);

      const result = await callHandler(
        makeEvent({
          attackerId: 'attacker-1',
          defenderId: 'defender-1',
          attackType: 'standard',
          units: { infantry: 10 },
        })
      );

      expect(result.success).toBe(true);
    });
  });

  describe('validation failures', () => {
    it('returns MISSING_PARAMS when attackerId is absent', async () => {
      const result = await callHandler(
        makeEvent({ defenderId: 'defender-1', units: { infantry: 10 } })
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('MISSING_PARAMS');
    });

    it('returns MISSING_PARAMS when defenderId is absent', async () => {
      const result = await callHandler(
        makeEvent({ attackerId: 'attacker-1', units: { infantry: 10 } })
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('MISSING_PARAMS');
    });

    it('returns MISSING_PARAMS when units is absent', async () => {
      const result = await callHandler(
        makeEvent({ attackerId: 'attacker-1', defenderId: 'defender-1' })
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('MISSING_PARAMS');
    });

    it('returns INVALID_PARAM when attacker and defender are the same', async () => {
      const result = await callHandler(
        makeEvent({ attackerId: 'kingdom-1', defenderId: 'kingdom-1', units: { infantry: 10 } })
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_PARAM');
    });

    it('returns INSUFFICIENT_RESOURCES when attacker sends more units than they own', async () => {
      const attackerKingdom = mockKingdom('attacker-1', {
        totalUnits: { infantry: 5, archers: 0, cavalry: 0, siege: 0, mages: 0, scouts: 0 },
      });
      const defenderKingdom = mockKingdom('defender-1');

      mockDbGet
        .mockResolvedValueOnce(attackerKingdom)
        .mockResolvedValueOnce(defenderKingdom);

      const result = await callHandler(
        makeEvent({
          attackerId: 'attacker-1',
          defenderId: 'defender-1',
          units: { infantry: 100 }, // has only 5
        })
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INSUFFICIENT_RESOURCES');
    });
  });

  describe('NOT_FOUND', () => {
    it('returns NOT_FOUND when attacker kingdom does not exist', async () => {
      mockDbGet
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockKingdom('defender-1'));

      const result = await callHandler(
        makeEvent({ attackerId: 'missing-attacker', defenderId: 'defender-1', units: { infantry: 10 } })
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('NOT_FOUND');
    });

    it('returns NOT_FOUND when defender kingdom does not exist', async () => {
      mockDbGet
        .mockResolvedValueOnce(mockKingdom('attacker-1'))
        .mockResolvedValueOnce(null);

      const result = await callHandler(
        makeEvent({ attackerId: 'attacker-1', defenderId: 'missing-defender', units: { infantry: 10 } })
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('NOT_FOUND');
    });
  });

  describe('race combat bonuses', () => {
    it('Droben attacker gets +20% offense bonus and still processes combat successfully', async () => {
      const attackerKingdom = mockKingdom('attacker-1', {
        race: 'Droben',
        totalUnits: { cavalry: 5000 },
      });
      const defenderKingdom = mockKingdom('defender-1', {
        totalUnits: { infantry: 10 },
        resources: { gold: 10000, population: 1000, mana: 100, land: 5000 },
      });

      mockDbGet
        .mockResolvedValueOnce(attackerKingdom)
        .mockResolvedValueOnce(defenderKingdom);

      const result = await callHandler(
        makeEvent({
          attackerId: 'attacker-1',
          defenderId: 'defender-1',
          attackType: 'standard',
          units: JSON.stringify({ cavalry: 5000 }),
        })
      );

      expect(result.success).toBe(true);
      const parsed = JSON.parse(result.result as string);
      expect(parsed).toHaveProperty('result');
      expect(parsed).toHaveProperty('landGained');
      // Droben gets 1.20x offense — combat should succeed (victory or with_ease)
      expect(['victory', 'with_ease']).toContain(parsed.result);
    });

    it('Dwarven defender gets +20% defense bonus, making it harder for attacker to win', async () => {
      // Attacker has moderate force; Dwarven defender's +20% defense bonus should reduce land gained
      const attackerKingdom = mockKingdom('attacker-1', {
        totalUnits: { infantry: 500 },
      });
      const defenderKingdom = mockKingdom('defender-1', {
        race: 'Dwarven',
        totalUnits: { infantry: 500 },
        resources: { gold: 10000, population: 1000, mana: 100, land: 5000 },
      });

      mockDbGet
        .mockResolvedValueOnce(attackerKingdom)
        .mockResolvedValueOnce(defenderKingdom);

      const result = await callHandler(
        makeEvent({
          attackerId: 'attacker-1',
          defenderId: 'defender-1',
          attackType: 'standard',
          units: JSON.stringify({ infantry: 500 }),
        })
      );

      // Combat should still process without error; the race bonus is applied internally
      expect(result.success).toBe(true);
      const parsed = JSON.parse(result.result as string);
      expect(parsed).toHaveProperty('result');
    });

    it('unknown race falls back to 1.0 bonus and processes combat normally', async () => {
      const attackerKingdom = mockKingdom('attacker-1', {
        race: 'UnknownRace',
        totalUnits: { cavalry: 5000 },
      });
      const defenderKingdom = mockKingdom('defender-1', {
        race: 'UnknownRace',
        totalUnits: { infantry: 10 },
        resources: { gold: 10000, population: 1000, mana: 100, land: 5000 },
      });

      mockDbGet
        .mockResolvedValueOnce(attackerKingdom)
        .mockResolvedValueOnce(defenderKingdom);

      const result = await callHandler(
        makeEvent({
          attackerId: 'attacker-1',
          defenderId: 'defender-1',
          attackType: 'standard',
          units: JSON.stringify({ cavalry: 5000 }),
        })
      );

      expect(result.success).toBe(true);
      const parsed = JSON.parse(result.result as string);
      expect(parsed).toHaveProperty('result');
      expect(parsed).toHaveProperty('landGained');
    });
  });

  describe('war declaration enforcement', () => {
    it('requires a WarDeclaration after 3 attacks in same season', async () => {
      const attackerKingdom = mockKingdom('attacker-1', { seasonId: 'season-1' });
      const defenderKingdom = mockKingdom('defender-1');

      // The handler calls dbGet multiple times (attacker, defender, then alliance coord check x2)
      // Use a stable implementation so subsequent calls return the right kingdoms
      mockDbGet.mockImplementation(async (model: string, id: string) => {
        if (model === 'Kingdom' && id === 'attacker-1') return attackerKingdom;
        if (model === 'Kingdom' && id === 'defender-1') return defenderKingdom;
        return null;
      });

      // 3 existing battle reports with matching attackerId/defenderId — threshold reached
      mockDbList.mockImplementation(async (model: string) => {
        if (model === 'BattleReport') return [
          { id: 'b1', attackerId: 'attacker-1', defenderId: 'defender-1' },
          { id: 'b2', attackerId: 'attacker-1', defenderId: 'defender-1' },
          { id: 'b3', attackerId: 'attacker-1', defenderId: 'defender-1' },
        ];
        return [];
      });
      // Handler uses dbQuery (GSI) to check for active WarDeclaration — no active war
      mockDbQuery.mockImplementation(async (model: string) => {
        if (model === 'WarDeclaration') return [];
        return [];
      });

      const result = await callHandler(
        makeEvent({
          attackerId: 'attacker-1',
          defenderId: 'defender-1',
          units: { infantry: 100 },
        })
      );

      const parsed = typeof result === 'string' ? JSON.parse(result) : result;
      expect(parsed.success).toBe(false);
      expect(parsed.errorCode).toBe('WAR_REQUIRED');
    });
  });
});
