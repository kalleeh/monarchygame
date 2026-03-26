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

vi.mock('../data-client', () => ({
  dbGet: mockDbGet,
  dbUpdate: mockDbUpdate,
  dbCreate: mockDbCreate,
  dbList: mockDbList,
  dbDelete: mockDbDelete,
  dbAtomicAdd: mockDbAtomicAdd,
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

function mockKingdom(overrides: Record<string, unknown> = {}) {
  return {
    id: 'kingdom-1',
    owner: 'test-sub-123',
    resources: { gold: 10000, population: 1000, mana: 500, land: 1000 },
    buildings: {},
    totalUnits: {},
    stats: { focusPoints: 50, faithAlignment: 'neutral' },
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
});

describe('faith-processor handler — selectAlignment', () => {
  describe('happy path', () => {
    it('sets faithAlignment in stats for a compatible race', async () => {
      // Human is compatible with 'angelique'
      mockDbGet.mockResolvedValue(mockKingdom({ race: 'Human' }));

      const result = await callHandler(
        makeEvent({ kingdomId: 'kingdom-1', action: 'selectAlignment', alignment: 'angelique' })
      );

      expect(result.success).toBe(true);
      const parsed = JSON.parse(result.result as string);
      expect(parsed.alignment).toBe('angelique');

      const updateCall = mockDbUpdate.mock.calls[0];
      expect(updateCall[2].stats.faithAlignment).toBe('angelique');
    });

    it('allows any race to select neutral alignment', async () => {
      mockDbGet.mockResolvedValue(mockKingdom({ race: 'Orc' }));

      const result = await callHandler(
        makeEvent({ kingdomId: 'kingdom-1', action: 'selectAlignment', alignment: 'neutral' })
      );

      expect(result.success).toBe(true);
    });
  });

  describe('validation failures', () => {
    it('returns MISSING_PARAMS when kingdomId is absent', async () => {
      const result = await callHandler(makeEvent({ action: 'selectAlignment', alignment: 'neutral' }));

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('MISSING_PARAMS');
    });

    it('returns MISSING_PARAMS when action is absent', async () => {
      const result = await callHandler(makeEvent({ kingdomId: 'kingdom-1', alignment: 'neutral' }));

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('MISSING_PARAMS');
    });

    it('returns INVALID_PARAM for an unknown alignment', async () => {
      const result = await callHandler(
        makeEvent({ kingdomId: 'kingdom-1', action: 'selectAlignment', alignment: 'chaos' })
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_PARAM');
    });

    it('returns INVALID_PARAM for an unknown action', async () => {
      const result = await callHandler(
        makeEvent({ kingdomId: 'kingdom-1', action: 'doRitual' })
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_PARAM');
    });

    it('returns VALIDATION_FAILED when race is incompatible with chosen alignment', async () => {
      // Orc is not in the 'angelique' compatible list
      mockDbGet.mockResolvedValue(mockKingdom({ race: 'Orc' }));

      const result = await callHandler(
        makeEvent({ kingdomId: 'kingdom-1', action: 'selectAlignment', alignment: 'angelique' })
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('VALIDATION_FAILED');
    });
  });

  describe('NOT_FOUND', () => {
    it('returns NOT_FOUND when kingdom does not exist', async () => {
      mockDbGet.mockResolvedValue(null);

      const result = await callHandler(
        makeEvent({ kingdomId: 'missing-id', action: 'selectAlignment', alignment: 'neutral' })
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('NOT_FOUND');
    });
  });
});

describe('faith-processor handler — useFocusAbility', () => {
  describe('happy path', () => {
    it('deducts focus points and returns remaining balance', async () => {
      // combat_focus costs 8; kingdom has 50 focus points
      mockDbGet.mockResolvedValue(mockKingdom({ stats: { focusPoints: 50 } }));

      const result = await callHandler(
        makeEvent({ kingdomId: 'kingdom-1', action: 'useFocusAbility', abilityType: 'combat_focus' })
      );

      expect(result.success).toBe(true);
      const parsed = JSON.parse(result.result as string);
      expect(parsed.abilityType).toBe('combat_focus');
      expect(parsed.cost).toBe(8);
      expect(parsed.remainingFocusPoints).toBe(42);
    });

    it('works for every valid ability type', async () => {
      const abilities: Array<[string, number]> = [
        ['racial_ability', 10],
        ['spell_power', 15],
        ['combat_focus', 8],
        ['economic_focus', 6],
        ['emergency', 20],
      ];

      for (const [abilityType, cost] of abilities) {
        vi.clearAllMocks();
        mockDbGet.mockResolvedValue(mockKingdom({ stats: { focusPoints: 100 } }));
        mockDbUpdate.mockResolvedValue(undefined);

        const result = await callHandler(
          makeEvent({ kingdomId: 'kingdom-1', action: 'useFocusAbility', abilityType })
        );

        expect(result.success).toBe(true);
        const parsed = JSON.parse(result.result as string);
        expect(parsed.cost).toBe(cost);
        expect(parsed.remainingFocusPoints).toBe(100 - cost);
      }
    });
  });

  describe('validation failures', () => {
    it('returns INVALID_PARAM for an unknown abilityType', async () => {
      const result = await callHandler(
        makeEvent({ kingdomId: 'kingdom-1', action: 'useFocusAbility', abilityType: 'dark_magic' })
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_PARAM');
    });
  });

  describe('INSUFFICIENT_RESOURCES', () => {
    it('returns INSUFFICIENT_RESOURCES when focus points are below the ability cost', async () => {
      // emergency costs 20; kingdom only has 5 focus points
      mockDbGet.mockResolvedValue(mockKingdom({ stats: { focusPoints: 5 } }));

      const result = await callHandler(
        makeEvent({ kingdomId: 'kingdom-1', action: 'useFocusAbility', abilityType: 'emergency' })
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INSUFFICIENT_RESOURCES');
      expect(mockDbUpdate).not.toHaveBeenCalled();
    });

    it('returns INSUFFICIENT_RESOURCES when focusPoints is 0', async () => {
      mockDbGet.mockResolvedValue(mockKingdom({ stats: { focusPoints: 0 } }));

      const result = await callHandler(
        makeEvent({ kingdomId: 'kingdom-1', action: 'useFocusAbility', abilityType: 'economic_focus' })
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INSUFFICIENT_RESOURCES');
    });
  });
});
