import { vi, describe, it, expect, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock aws-amplify/data before importing the handler
// ---------------------------------------------------------------------------

const mockClient = vi.hoisted(() => ({
  models: {
    Kingdom: {
      get: vi.fn(),
      update: vi.fn(),
      list: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock('aws-amplify/data', () => ({
  generateClient: () => mockClient,
}));

import { handler } from './handler';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(args: Record<string, unknown>) {
  return { arguments: args, identity: { sub: 'test-sub-123', username: 'test-user' } } as any;
}

function mockKingdom(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      id: 'kingdom-1',
      owner: 'test-user::owner',
      resources: { gold: 10000, population: 1000, mana: 500, land: 1000 },
      buildings: { mine: 0, farm: 0, tower: 0, temple: 0, castle: 0, barracks: 0, wall: 0 },
      totalUnits: { infantry: 0, archers: 0, cavalry: 0, siege: 0, mages: 0, scouts: 200 },
      stats: {},
      race: 'Human',
      ...overrides,
    },
    errors: null,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockClient.models.Kingdom.update.mockResolvedValue({ data: {}, errors: null });
});

describe('spell-caster handler', () => {
  describe('happy path — self-targeted spell', () => {
    it('deducts 50 mana from caster for calming_chant (no-damage spell)', async () => {
      mockClient.models.Kingdom.get.mockResolvedValue(mockKingdom());

      const result = await handler(makeEvent({ casterId: 'kingdom-1', spellId: 'calming_chant' }));

      expect(result.success).toBe(true);
      const parsed = JSON.parse(result.result as string);
      expect(parsed.manaUsed).toBe(50);
      expect(parsed.remainingMana).toBe(450);

      // Only one update — caster's mana
      expect(mockClient.models.Kingdom.update).toHaveBeenCalledOnce();
    });

    it('deducts mana when casting at a target (structure_damage spell)', async () => {
      const caster = mockKingdom({ id: 'caster-1', resources: { gold: 1000, population: 500, mana: 200, land: 1000 } });
      const target = mockKingdom({
        id: 'target-1',
        resources: { gold: 5000, population: 2000, mana: 100, land: 1000 },
        buildings: { mine: 10, farm: 10, tower: 0, temple: 0, castle: 0, barracks: 0, wall: 0 },
      });

      // First call: validate target exists; second call: get caster; then get target again for applying damage
      mockClient.models.Kingdom.get
        .mockResolvedValueOnce(target)   // validate target
        .mockResolvedValueOnce(caster)   // get caster for mana check
        .mockResolvedValueOnce(target);  // re-fetch target for damage

      const result = await handler(
        makeEvent({ casterId: 'caster-1', spellId: 'hurricane', targetId: 'target-1' })
      );

      expect(result.success).toBe(true);
      const parsed = JSON.parse(result.result as string);
      expect(parsed.manaUsed).toBe(50);
      expect(parsed.damageReport.type).toBe('structure_damage');
    });
  });

  describe('validation failures', () => {
    it('returns MISSING_PARAMS when casterId is absent', async () => {
      const result = await handler(makeEvent({ spellId: 'calming_chant' }));

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('MISSING_PARAMS');
    });

    it('returns MISSING_PARAMS when spellId is absent', async () => {
      const result = await handler(makeEvent({ casterId: 'kingdom-1' }));

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('MISSING_PARAMS');
    });

    it('returns INVALID_PARAM for an unknown spell', async () => {
      const result = await handler(makeEvent({ casterId: 'kingdom-1', spellId: 'fireball' }));

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_PARAM');
    });

    it('returns INVALID_PARAM when spellId exceeds 64 characters', async () => {
      const result = await handler(makeEvent({ casterId: 'kingdom-1', spellId: 's'.repeat(65) }));

      expect(result.success).toBe(false);
      // handler checks length before checking valid spells list — both produce INVALID_PARAM
      expect(result.errorCode).toBe('INVALID_PARAM');
    });
  });

  describe('NOT_FOUND', () => {
    it('returns NOT_FOUND when target kingdom does not exist', async () => {
      mockClient.models.Kingdom.get.mockResolvedValue({ data: null, errors: null });

      const result = await handler(
        makeEvent({ casterId: 'kingdom-1', spellId: 'calming_chant', targetId: 'ghost-kingdom' })
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('NOT_FOUND');
    });

    it('returns NOT_FOUND when caster kingdom does not exist', async () => {
      // targetId check passes, caster check returns null
      mockClient.models.Kingdom.get
        .mockResolvedValueOnce(mockKingdom({ id: 'target-1' })) // target validation
        .mockResolvedValueOnce({ data: null, errors: null });    // caster not found

      const result = await handler(
        makeEvent({ casterId: 'missing-caster', spellId: 'calming_chant', targetId: 'target-1' })
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('NOT_FOUND');
    });
  });

  describe('INSUFFICIENT_RESOURCES', () => {
    it('returns INSUFFICIENT_RESOURCES when mana is below 50', async () => {
      mockClient.models.Kingdom.get.mockResolvedValue(
        mockKingdom({ resources: { gold: 10000, population: 1000, mana: 30, land: 1000 } })
      );

      const result = await handler(makeEvent({ casterId: 'kingdom-1', spellId: 'calming_chant' }));

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INSUFFICIENT_RESOURCES');
      expect(mockClient.models.Kingdom.update).not.toHaveBeenCalled();
    });

    it('returns INSUFFICIENT_RESOURCES when mana is exactly 0', async () => {
      mockClient.models.Kingdom.get.mockResolvedValue(
        mockKingdom({ resources: { gold: 10000, population: 1000, mana: 0, land: 1000 } })
      );

      const result = await handler(makeEvent({ casterId: 'kingdom-1', spellId: 'hurricane' }));

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INSUFFICIENT_RESOURCES');
    });
  });
});
