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
    Territory: {
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
  mockClient.models.Territory.list.mockResolvedValue({ data: [], errors: null });
  mockClient.models.Territory.create.mockResolvedValue({ data: { id: 'territory-1' }, errors: null });
});

describe('territory-claimer handler', () => {
  describe('happy path', () => {
    it('creates a territory and deducts 500 gold', async () => {
      mockClient.models.Kingdom.get.mockResolvedValue(mockKingdom());

      const result = await handler(
        makeEvent({ kingdomId: 'kingdom-1', territoryName: 'Forest Keep', territoryType: 'settlement', terrainType: 'forest', coordinates: { x: 10, y: 20 } })
      );

      expect(result.success).toBe(true);
      expect(result.territory).toBe('Forest Keep');

      // Gold deduction
      const updateCall = mockClient.models.Kingdom.update.mock.calls[0][0];
      expect(updateCall.resources.gold).toBe(10000 - 500);

      // Territory created
      expect(mockClient.models.Territory.create).toHaveBeenCalledOnce();
    });

    it('uses default values for territoryType and terrainType when omitted', async () => {
      mockClient.models.Kingdom.get.mockResolvedValue(mockKingdom());

      const result = await handler(
        makeEvent({ kingdomId: 'kingdom-1', territoryName: 'My Land' })
      );

      expect(result.success).toBe(true);
      const createCall = mockClient.models.Territory.create.mock.calls[0][0];
      expect(createCall.type).toBe('settlement');
      expect(createCall.terrainType).toBe('plains');
    });
  });

  describe('validation failures', () => {
    it('returns MISSING_PARAMS when kingdomId is absent', async () => {
      const result = await handler(makeEvent({ territoryName: 'Forest Keep' }));

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('MISSING_PARAMS');
    });

    it('returns MISSING_PARAMS when territoryName is absent', async () => {
      const result = await handler(makeEvent({ kingdomId: 'kingdom-1' }));

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('MISSING_PARAMS');
    });

    it('returns INVALID_PARAM when territoryName is too short (< 2 chars)', async () => {
      const result = await handler(
        makeEvent({ kingdomId: 'kingdom-1', territoryName: 'X' })
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_PARAM');
    });

    it('returns INVALID_PARAM when territoryName exceeds 50 chars', async () => {
      const result = await handler(
        makeEvent({ kingdomId: 'kingdom-1', territoryName: 'A'.repeat(51) })
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_PARAM');
    });

    it('returns INVALID_PARAM when coordinates are out of range', async () => {
      const result = await handler(
        makeEvent({ kingdomId: 'kingdom-1', territoryName: 'Far Lands', coordinates: { x: 99999, y: 0 } })
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_PARAM');
    });

    it('returns INVALID_PARAM when territory already claimed at these coordinates', async () => {
      mockClient.models.Kingdom.get.mockResolvedValue(mockKingdom());
      mockClient.models.Territory.list.mockResolvedValue({
        data: [{ id: 'existing', coordinates: JSON.stringify({ x: 5, y: 5 }) }],
        errors: null,
      });

      const result = await handler(
        makeEvent({ kingdomId: 'kingdom-1', territoryName: 'Overlap', coordinates: { x: 5, y: 5 } })
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_PARAM');
    });
  });

  describe('NOT_FOUND', () => {
    it('returns NOT_FOUND when kingdom does not exist', async () => {
      mockClient.models.Kingdom.get.mockResolvedValue({ data: null, errors: null });

      const result = await handler(
        makeEvent({ kingdomId: 'missing-id', territoryName: 'Forest Keep' })
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('NOT_FOUND');
    });
  });

  describe('INSUFFICIENT_RESOURCES', () => {
    it('returns INSUFFICIENT_RESOURCES when gold is below 500', async () => {
      mockClient.models.Kingdom.get.mockResolvedValue(
        mockKingdom({ resources: { gold: 400, population: 1000, mana: 500, land: 1000 } })
      );

      const result = await handler(
        makeEvent({ kingdomId: 'kingdom-1', territoryName: 'Poor Fort' })
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INSUFFICIENT_RESOURCES');
      expect(mockClient.models.Territory.create).not.toHaveBeenCalled();
    });
  });
});
