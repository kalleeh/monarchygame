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

vi.mock('../rate-limiter', () => ({ checkRateLimit: vi.fn().mockReturnValue(null) }));

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
    resources: { gold: 10000, population: 1000, elan: 500, land: 1000 },
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
});

describe('spell-caster handler', () => {
  describe('happy path — self-targeted spell', () => {
    it('deducts elan from caster for calming_chant (no-damage spell)', async () => {
      mockDbGet.mockResolvedValue(mockKingdom());

      const result = await callHandler(makeEvent({ casterId: 'kingdom-1', spellId: 'calming_chant' }));

      expect(result.success).toBe(true);
      const parsed = JSON.parse(result.result as string);
      expect(parsed.elanUsed).toBe(5); // calming_chant costs 5 elan
      expect(parsed.remainingElan).toBe(495);

      // Only one update — caster's elan
      expect(mockDbUpdate).toHaveBeenCalledOnce();
    });

    it('deducts elan when casting at a target (structure_damage spell)', async () => {
      const caster = mockKingdom({ id: 'caster-1', resources: { gold: 1000, population: 500, elan: 200, land: 1000 } });
      const target = mockKingdom({
        id: 'target-1',
        resources: { gold: 5000, population: 2000, elan: 100, land: 1000 },
        buildings: { mine: 10, farm: 10, tower: 0, temple: 0, castle: 0, barracks: 0, wall: 0 },
      });

      // Caster fetched first, then target fetched for damage application
      mockDbGet
        .mockResolvedValueOnce(caster)   // get caster
        .mockResolvedValueOnce(target);  // re-fetch target for damage

      const result = await callHandler(
        makeEvent({ casterId: 'caster-1', spellId: 'hurricane', targetId: 'target-1' })
      );

      expect(result.success).toBe(true);
      const parsed = JSON.parse(result.result as string);
      expect(parsed.elanUsed).toBe(20); // hurricane costs 20 elan
      expect(parsed.damageReport.type).toBe('structure_damage');
    });
  });

  describe('validation failures', () => {
    it('returns MISSING_PARAMS when casterId is absent', async () => {
      const result = await callHandler(makeEvent({ spellId: 'calming_chant' }));

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('MISSING_PARAMS');
    });

    it('returns MISSING_PARAMS when spellId is absent', async () => {
      const result = await callHandler(makeEvent({ casterId: 'kingdom-1' }));

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('MISSING_PARAMS');
    });

    it('returns INVALID_PARAM for an unknown spell', async () => {
      const result = await callHandler(makeEvent({ casterId: 'kingdom-1', spellId: 'fireball' }));

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_PARAM');
    });

    it('returns INVALID_PARAM when spellId exceeds 64 characters', async () => {
      const result = await callHandler(makeEvent({ casterId: 'kingdom-1', spellId: 's'.repeat(65) }));

      expect(result.success).toBe(false);
      // handler checks length before checking valid spells list — both produce INVALID_PARAM
      expect(result.errorCode).toBe('INVALID_PARAM');
    });
  });

  describe('NOT_FOUND', () => {
    it('returns NOT_FOUND when target kingdom does not exist', async () => {
      mockDbGet.mockResolvedValue(null);

      const result = await callHandler(
        makeEvent({ casterId: 'kingdom-1', spellId: 'calming_chant', targetId: 'ghost-kingdom' })
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('NOT_FOUND');
    });

    it('returns NOT_FOUND when caster kingdom does not exist', async () => {
      // Caster is fetched first in handler; returns null → NOT_FOUND
      mockDbGet.mockResolvedValueOnce(null);

      const result = await callHandler(
        makeEvent({ casterId: 'missing-caster', spellId: 'calming_chant', targetId: 'target-1' })
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('NOT_FOUND');
    });
  });

  describe('SPELL_POWER_BOOST faith effect', () => {
    it('SPELL_POWER_BOOST amplifies hurricane structure damage by 1.3x', async () => {
      const futureExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const caster = mockKingdom({
        id: 'caster-1',
        resources: { gold: 1000, population: 500, elan: 200, land: 1000 },
        stats: {
          activeFaithEffects: [
            { effectType: 'SPELL_POWER_BOOST', appliedAt: new Date().toISOString(), expiresAt: futureExpiry },
          ],
        },
      });
      // 100 mines — hurricane deals 5% structure damage, so base = 5, with 1.3x = Math.floor(100 * 0.05 * 1.3) = 6
      const target = mockKingdom({
        id: 'target-1',
        resources: { gold: 5000, population: 2000, elan: 100, land: 1000 },
        buildings: { mine: 100, farm: 0, tower: 0, temple: 0, castle: 0, barracks: 0, wall: 0 },
        createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
      });

      mockDbGet
        .mockResolvedValueOnce(caster)  // fetch caster
        .mockResolvedValueOnce(target); // fetch target for protection checks

      const result = await callHandler(
        makeEvent({ casterId: 'caster-1', spellId: 'hurricane', targetId: 'target-1' })
      );

      expect(result.success).toBe(true);
      const parsed = JSON.parse(result.result as string);
      expect(parsed.damageReport.type).toBe('structure_damage');

      // Find the dbUpdate call that updates the target's buildings
      const buildingUpdateCall = mockDbUpdate.mock.calls.find(
        (call: unknown[]) => call[0] === 'Kingdom' && call[1] === 'target-1' && (call[2] as Record<string, unknown>).buildings
      );
      expect(buildingUpdateCall).toBeDefined();
      const updatedBuildings = (buildingUpdateCall![2] as Record<string, unknown>).buildings as Record<string, number>;
      // Base: 100 mines, 5% damage without boost = 5 destroyed (95 remaining)
      // With 1.3x boost: Math.floor(100 * 0.05 * 1.3) = 6 destroyed (94 remaining)
      expect(updatedBuildings.mine).toBe(94);
    });
  });

  describe('INSUFFICIENT_RESOURCES', () => {
    it('returns INSUFFICIENT_RESOURCES when elan is below cost', async () => {
      mockDbGet.mockResolvedValue(
        mockKingdom({ resources: { gold: 10000, population: 1000, elan: 4, land: 1000 } })
      );

      const result = await callHandler(makeEvent({ casterId: 'kingdom-1', spellId: 'calming_chant' }));

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INSUFFICIENT_RESOURCES');
      expect(mockDbUpdate).not.toHaveBeenCalled();
    });

    it('returns INSUFFICIENT_RESOURCES when elan is exactly 0', async () => {
      mockDbGet.mockResolvedValue(
        mockKingdom({ resources: { gold: 10000, population: 1000, elan: 0, land: 1000 } })
      );

      const result = await callHandler(makeEvent({ casterId: 'kingdom-1', spellId: 'hurricane' }));

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INSUFFICIENT_RESOURCES');
    });
  });
});
