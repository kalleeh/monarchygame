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

describe('unit-trainer handler', () => {
  describe('happy path', () => {
    it('deducts 100 gold per unit and increments unit count', async () => {
      mockClient.models.Kingdom.get.mockResolvedValue(mockKingdom());

      const result = await handler(makeEvent({ kingdomId: 'kingdom-1', unitType: 'infantry', quantity: 5 }));

      expect(result.success).toBe(true);
      const units = JSON.parse(result.units as string);
      expect(units.infantry).toBe(5);

      // 5 * 100 = 500 gold deducted
      const updateCall = mockClient.models.Kingdom.update.mock.calls[0][0];
      expect(updateCall.resources.gold).toBe(10000 - 500);
    });

    it('works for every valid unit type', async () => {
      const types = ['infantry', 'archers', 'cavalry', 'siege', 'mages', 'scouts'];
      for (const unitType of types) {
        vi.clearAllMocks();
        mockClient.models.Kingdom.get.mockResolvedValue(mockKingdom());
        mockClient.models.Kingdom.update.mockResolvedValue({ data: {}, errors: null });

        const result = await handler(makeEvent({ kingdomId: 'kingdom-1', unitType, quantity: 1 }));

        expect(result.success).toBe(true);
        const units = JSON.parse(result.units as string);
        // scouts starts at 200; others start at 0
        expect(units[unitType]).toBeGreaterThanOrEqual(1);
      }
    });

    it('adds to existing unit count', async () => {
      mockClient.models.Kingdom.get.mockResolvedValue(
        mockKingdom({ totalUnits: { infantry: 50, archers: 0, cavalry: 0, siege: 0, mages: 0, scouts: 200 } })
      );

      const result = await handler(makeEvent({ kingdomId: 'kingdom-1', unitType: 'infantry', quantity: 10 }));

      expect(result.success).toBe(true);
      const units = JSON.parse(result.units as string);
      expect(units.infantry).toBe(60);
    });
  });

  describe('validation failures', () => {
    it('returns MISSING_PARAMS when kingdomId is absent', async () => {
      const result = await handler(makeEvent({ unitType: 'infantry', quantity: 1 }));

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('MISSING_PARAMS');
    });

    it('returns MISSING_PARAMS when unitType is absent', async () => {
      const result = await handler(makeEvent({ kingdomId: 'kingdom-1', quantity: 1 }));

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('MISSING_PARAMS');
    });

    it('returns MISSING_PARAMS when quantity is absent', async () => {
      const result = await handler(makeEvent({ kingdomId: 'kingdom-1', unitType: 'infantry' }));

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('MISSING_PARAMS');
    });

    it('returns INVALID_PARAM for unrecognised unit type', async () => {
      const result = await handler(makeEvent({ kingdomId: 'kingdom-1', unitType: 'dragon', quantity: 1 }));

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_PARAM');
    });

    it('returns INVALID_PARAM when quantity is 0', async () => {
      const result = await handler(makeEvent({ kingdomId: 'kingdom-1', unitType: 'infantry', quantity: 0 }));

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_PARAM');
    });

    it('returns INVALID_PARAM when quantity exceeds 1000', async () => {
      const result = await handler(makeEvent({ kingdomId: 'kingdom-1', unitType: 'infantry', quantity: 1001 }));

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_PARAM');
    });
  });

  describe('NOT_FOUND', () => {
    it('returns NOT_FOUND when kingdom does not exist', async () => {
      mockClient.models.Kingdom.get.mockResolvedValue({ data: null, errors: null });

      const result = await handler(makeEvent({ kingdomId: 'missing-id', unitType: 'infantry', quantity: 1 }));

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('NOT_FOUND');
    });
  });

  describe('INSUFFICIENT_RESOURCES', () => {
    it('returns INSUFFICIENT_RESOURCES when gold is below cost', async () => {
      // 20 infantry = 2000 gold, but kingdom has only 1500
      mockClient.models.Kingdom.get.mockResolvedValue(
        mockKingdom({ resources: { gold: 1500, population: 1000, mana: 500, land: 1000 } })
      );

      const result = await handler(makeEvent({ kingdomId: 'kingdom-1', unitType: 'infantry', quantity: 20 }));

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INSUFFICIENT_RESOURCES');
      expect(mockClient.models.Kingdom.update).not.toHaveBeenCalled();
    });
  });
});
