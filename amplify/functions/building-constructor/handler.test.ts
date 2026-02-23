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

describe('building-constructor handler', () => {
  describe('happy path', () => {
    it('deducts 250 gold per building and increments building count', async () => {
      mockClient.models.Kingdom.get.mockResolvedValue(mockKingdom());

      const result = await handler(makeEvent({ kingdomId: 'kingdom-1', buildingType: 'mine', quantity: 2 }));

      expect(result.success).toBe(true);
      const buildings = JSON.parse(result.buildings as string);
      expect(buildings.mine).toBe(2);

      // Verify update called with correct resource deduction (2 * 250 = 500)
      const updateCall = mockClient.models.Kingdom.update.mock.calls[0][0];
      expect(updateCall.resources.gold).toBe(10000 - 500);
    });

    it('works for every valid building type', async () => {
      const types = ['castle', 'barracks', 'farm', 'mine', 'temple', 'tower', 'wall'];
      for (const buildingType of types) {
        vi.clearAllMocks();
        mockClient.models.Kingdom.get.mockResolvedValue(mockKingdom());
        mockClient.models.Kingdom.update.mockResolvedValue({ data: {}, errors: null });

        const result = await handler(makeEvent({ kingdomId: 'kingdom-1', buildingType, quantity: 1 }));

        expect(result.success).toBe(true);
        const buildings = JSON.parse(result.buildings as string);
        expect(buildings[buildingType]).toBe(1);
      }
    });

    it('adds to existing building count', async () => {
      mockClient.models.Kingdom.get.mockResolvedValue(
        mockKingdom({ buildings: { mine: 5, farm: 0, tower: 0, temple: 0, castle: 0, barracks: 0, wall: 0 } })
      );

      const result = await handler(makeEvent({ kingdomId: 'kingdom-1', buildingType: 'mine', quantity: 3 }));

      expect(result.success).toBe(true);
      const buildings = JSON.parse(result.buildings as string);
      expect(buildings.mine).toBe(8);
    });
  });

  describe('validation failures', () => {
    it('returns MISSING_PARAMS when kingdomId is absent', async () => {
      const result = await handler(makeEvent({ buildingType: 'mine', quantity: 1 }));

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('MISSING_PARAMS');
      expect(mockClient.models.Kingdom.get).not.toHaveBeenCalled();
    });

    it('returns MISSING_PARAMS when buildingType is absent', async () => {
      const result = await handler(makeEvent({ kingdomId: 'kingdom-1', quantity: 1 }));

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('MISSING_PARAMS');
    });

    it('returns MISSING_PARAMS when quantity is absent', async () => {
      const result = await handler(makeEvent({ kingdomId: 'kingdom-1', buildingType: 'mine' }));

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('MISSING_PARAMS');
    });

    it('returns INVALID_PARAM for an unrecognised building type', async () => {
      const result = await handler(makeEvent({ kingdomId: 'kingdom-1', buildingType: 'dungeon', quantity: 1 }));

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_PARAM');
    });

    it('returns INVALID_PARAM when quantity is 0', async () => {
      const result = await handler(makeEvent({ kingdomId: 'kingdom-1', buildingType: 'mine', quantity: 0 }));

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_PARAM');
    });

    it('returns INVALID_PARAM when quantity exceeds 100', async () => {
      const result = await handler(makeEvent({ kingdomId: 'kingdom-1', buildingType: 'mine', quantity: 101 }));

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_PARAM');
    });

    it('returns INVALID_PARAM when quantity is a float', async () => {
      const result = await handler(makeEvent({ kingdomId: 'kingdom-1', buildingType: 'mine', quantity: 1.5 }));

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_PARAM');
    });
  });

  describe('NOT_FOUND', () => {
    it('returns NOT_FOUND when kingdom does not exist', async () => {
      mockClient.models.Kingdom.get.mockResolvedValue({ data: null, errors: null });

      const result = await handler(makeEvent({ kingdomId: 'missing-id', buildingType: 'mine', quantity: 1 }));

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('NOT_FOUND');
    });
  });

  describe('INSUFFICIENT_RESOURCES', () => {
    it('returns INSUFFICIENT_RESOURCES when gold is below cost', async () => {
      // 3 mines = 750 gold cost, but kingdom only has 500 gold
      mockClient.models.Kingdom.get.mockResolvedValue(
        mockKingdom({ resources: { gold: 500, population: 1000, mana: 500, land: 1000 } })
      );

      const result = await handler(makeEvent({ kingdomId: 'kingdom-1', buildingType: 'mine', quantity: 3 }));

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INSUFFICIENT_RESOURCES');
      expect(mockClient.models.Kingdom.update).not.toHaveBeenCalled();
    });

    it('succeeds when gold is exactly equal to cost', async () => {
      // 1 mine = 250 gold cost, kingdom has exactly 250 gold
      mockClient.models.Kingdom.get.mockResolvedValue(
        mockKingdom({ resources: { gold: 250, population: 1000, mana: 500, land: 1000 } })
      );

      const result = await handler(makeEvent({ kingdomId: 'kingdom-1', buildingType: 'mine', quantity: 1 }));

      expect(result.success).toBe(true);
      const updateCall = mockClient.models.Kingdom.update.mock.calls[0][0];
      expect(updateCall.resources.gold).toBe(0);
    });
  });
});
