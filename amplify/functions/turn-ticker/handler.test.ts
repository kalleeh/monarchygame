import { vi, describe, it, expect, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock ../data-client before importing the handler
// ---------------------------------------------------------------------------

const mockDbList = vi.hoisted(() => vi.fn());
const mockDbAtomicAdd = vi.hoisted(() => vi.fn());
const mockDbUpdate = vi.hoisted(() => vi.fn());
const mockDbCreate = vi.hoisted(() => vi.fn());
const mockDbGet = vi.hoisted(() => vi.fn());
const mockDbQuery = vi.hoisted(() => vi.fn());
const mockDbDelete = vi.hoisted(() => vi.fn());

vi.mock('../data-client', () => ({
  dbList: mockDbList,
  dbAtomicAdd: mockDbAtomicAdd,
  dbUpdate: mockDbUpdate,
  dbCreate: mockDbCreate,
  dbGet: mockDbGet,
  dbQuery: mockDbQuery,
  dbDelete: mockDbDelete,
  parseJsonField: <T>(value: unknown, defaultValue: T): T => {
    if (value === null || value === undefined) return defaultValue;
    if (typeof value === 'string') { try { return JSON.parse(value) as T; } catch { return defaultValue; } }
    return value as T;
  },
}));

import { handler } from './handler';

// ---------------------------------------------------------------------------
// Type helpers
// ---------------------------------------------------------------------------

interface TickerResult {
  success: boolean;
  ticked: number;
  skipped: number;
}

const callHandler = handler as unknown as (event: unknown) => Promise<TickerResult>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeKingdom(overrides: Record<string, unknown> = {}) {
  return {
    id: 'kingdom-1',
    isActive: true,
    isAI: false,
    turnsBalance: 0,
    race: 'human',
    stats: JSON.stringify({ focusPoints: 0 }),
    resources: JSON.stringify({ gold: 10000, population: 5000, land: 1000 }),
    totalUnits: JSON.stringify({}),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockDbAtomicAdd.mockResolvedValue(undefined);
  mockDbUpdate.mockResolvedValue(undefined);
  mockDbCreate.mockResolvedValue(undefined);
  mockDbGet.mockResolvedValue({ id: 'kingdom-1' });
});

describe('turn-ticker handler — settlement completion', () => {
  it('creates a Territory record when a pending settlement is ready and removes it from stats', async () => {
    const pastTime = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1 hour ago
    const kingdom = makeKingdom({
      stats: JSON.stringify({
        focusPoints: 0,
        pendingSettlements: [
          {
            name: 'Riverdale',
            completesAt: pastTime,
            type: 'settlement',
            coordinates: JSON.stringify({ x: 10, y: 20 }),
            terrainType: 'plains',
            ownerSub: 'test-owner',
            regionId: 'region-1',
          },
        ],
      }),
    });
    mockDbList.mockResolvedValue([kingdom]);
    mockDbGet.mockResolvedValue({ id: 'kingdom-1' });

    const result = await callHandler({});

    expect(result.success).toBe(true);

    // dbCreate should have been called to create the Territory record
    expect(mockDbCreate).toHaveBeenCalledWith(
      'Territory',
      expect.objectContaining({ name: 'Riverdale', kingdomId: 'kingdom-1' })
    );

    // dbUpdate should have been called with an empty pendingSettlements array
    const settlementUpdateCall = mockDbUpdate.mock.calls.find(
      (call: unknown[]) =>
        call[0] === 'Kingdom' &&
        call[1] === 'kingdom-1' &&
        typeof (call[2] as Record<string, unknown>)?.stats === 'string' &&
        JSON.parse((call[2] as Record<string, unknown>).stats as string).pendingSettlements !== undefined
    );
    expect(settlementUpdateCall).toBeDefined();
    const updatedStats = JSON.parse((settlementUpdateCall![2] as Record<string, unknown>).stats as string);
    expect(updatedStats.pendingSettlements).toHaveLength(0);
  });
});

describe('turn-ticker handler — encamp bonus capping', () => {
  it('caps encamp bonus so turnsBalance does not exceed 72', async () => {
    const pastTime = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // ended 1 hour ago
    const kingdom = makeKingdom({
      turnsBalance: 70,
      encampEndTime: pastTime,
      encampBonusTurns: 10,
    });
    mockDbList.mockResolvedValue([kingdom]);

    const result = await callHandler({});

    expect(result.success).toBe(true);

    // The capped bonus should be Math.min(10, 72 - 70) = 2
    // dbAtomicAdd is called first with +1 (the normal tick), then with cappedBonus
    const encampAddCalls = mockDbAtomicAdd.mock.calls.filter(
      (call: unknown[]) =>
        call[0] === 'Kingdom' &&
        call[1] === 'kingdom-1' &&
        call[2] === 'turnsBalance' &&
        (call[3] as number) > 0
    );
    // One of those calls should have the value 2 (capped bonus)
    const cappedBonusCall = encampAddCalls.find((call: unknown[]) => call[3] === 2);
    expect(cappedBonusCall).toBeDefined();
  });
});

describe('turn-ticker handler — AI kingdom ticking', () => {
  it('updates gold and population for an AI kingdom (not the regular turn path)', async () => {
    const aiKingdom = makeKingdom({
      isAI: true,
      resources: JSON.stringify({ gold: 10000, population: 5000, land: 1000 }),
      totalUnits: JSON.stringify({ peasants: 100 }),
    });
    mockDbList.mockResolvedValue([aiKingdom]);

    const result = await callHandler({});

    expect(result.success).toBe(true);

    // dbUpdate should be called on the AI kingdom with updated gold/population
    const aiUpdateCall = mockDbUpdate.mock.calls.find(
      (call: unknown[]) =>
        call[0] === 'Kingdom' &&
        call[1] === 'kingdom-1' &&
        typeof (call[2] as Record<string, unknown>)?.resources === 'string'
    );
    expect(aiUpdateCall).toBeDefined();
    const updatedResources = JSON.parse((aiUpdateCall![2] as Record<string, unknown>).resources as string);
    // Gold should have increased by AI_GOLD_PER_TICK (5000)
    expect(updatedResources.gold).toBeGreaterThan(10000);
    // Population should have increased by AI_POPULATION_PER_TICK (500)
    expect(updatedResources.population).toBeGreaterThan(5000);
  });
});

describe('turn-ticker handler — faith regen', () => {
  it('increments focusPoints for an active non-AI kingdom', async () => {
    const kingdom = makeKingdom({
      stats: JSON.stringify({ focusPoints: 0 }),
      race: 'human',
    });
    mockDbList.mockResolvedValue([kingdom]);

    const result = await callHandler({});

    expect(result.success).toBe(true);

    // Find the dbUpdate call that writes stats (faith regen)
    const faithUpdateCall = mockDbUpdate.mock.calls.find(
      (call: unknown[]) =>
        call[0] === 'Kingdom' &&
        call[1] === 'kingdom-1' &&
        typeof (call[2] as Record<string, unknown>)?.stats === 'string' &&
        JSON.parse((call[2] as Record<string, unknown>).stats as string).focusPoints > 0
    );
    expect(faithUpdateCall).toBeDefined();
    const updatedStats = JSON.parse((faithUpdateCall![2] as Record<string, unknown>).stats as string);
    expect(updatedStats.focusPoints).toBeGreaterThan(0);
  });

  it('does not exceed maxFP cap', async () => {
    // Set focusPoints already at max (100 for human, modifier 1.0)
    const kingdom = makeKingdom({
      stats: JSON.stringify({ focusPoints: 100 }),
      race: 'human',
    });
    mockDbList.mockResolvedValue([kingdom]);

    const result = await callHandler({});

    expect(result.success).toBe(true);

    // No faith update should be written since currentFP === newFP
    const faithUpdateCall = mockDbUpdate.mock.calls.find(
      (call: unknown[]) =>
        call[0] === 'Kingdom' &&
        call[1] === 'kingdom-1' &&
        typeof (call[2] as Record<string, unknown>)?.stats === 'string' &&
        JSON.parse((call[2] as Record<string, unknown>).stats as string).focusPoints !== undefined
    );
    // Either no call or the value equals the cap (not exceeded)
    if (faithUpdateCall) {
      const updatedStats = JSON.parse((faithUpdateCall[2] as Record<string, unknown>).stats as string);
      expect(updatedStats.focusPoints).toBeLessThanOrEqual(100);
    }
  });

  it('returns success even when faith regen throws an error', async () => {
    const kingdom = makeKingdom({
      stats: 'INVALID_JSON{{{',
      race: 'human',
    });
    mockDbList.mockResolvedValue([kingdom]);

    const result = await callHandler({});

    expect(result.success).toBe(true);
  });

  it('regenerates focusPoints for a kingdom with focusPoints: 5 and faithAlignment: combat', async () => {
    const kingdom = makeKingdom({
      stats: JSON.stringify({ focusPoints: 5, faithAlignment: 'combat' }),
      race: 'human',
    });
    mockDbList.mockResolvedValue([kingdom]);

    const result = await callHandler({});

    expect(result.success).toBe(true);

    // Faith regen should write back an updated focusPoints > 5
    const faithUpdateCall = mockDbUpdate.mock.calls.find(
      (call: unknown[]) =>
        call[0] === 'Kingdom' &&
        call[1] === 'kingdom-1' &&
        typeof (call[2] as Record<string, unknown>)?.stats === 'string' &&
        JSON.parse((call[2] as Record<string, unknown>).stats as string).focusPoints !== undefined
    );
    expect(faithUpdateCall).toBeDefined();
    const updatedStats = JSON.parse((faithUpdateCall![2] as Record<string, unknown>).stats as string);
    expect(updatedStats.focusPoints).toBeGreaterThan(5);
    // faithAlignment should be preserved
    expect(updatedStats.faithAlignment).toBe('combat');
  });
});
