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
        typeof call[2]?.stats === 'string' &&
        JSON.parse(call[2].stats as string).focusPoints > 0
    );
    expect(faithUpdateCall).toBeDefined();
    const updatedStats = JSON.parse(faithUpdateCall![2].stats as string);
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
        typeof call[2]?.stats === 'string' &&
        JSON.parse(call[2].stats as string).focusPoints !== undefined
    );
    // Either no call or the value equals the cap (not exceeded)
    if (faithUpdateCall) {
      const updatedStats = JSON.parse(faithUpdateCall[2].stats as string);
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
});
