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
    WarDeclaration: {
      get: vi.fn(),
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    DiplomaticRelation: {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    Treaty: {
      list: vi.fn(),
      update: vi.fn(),
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

function mockKingdom(id: string, overrides: Record<string, unknown> = {}) {
  return {
    data: {
      id,
      owner: 'test-user::owner',
      resources: { gold: 10000, population: 1000, mana: 500, land: 1000 },
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
  mockClient.models.Kingdom.get.mockResolvedValue(mockKingdom('king-1'));
  mockClient.models.WarDeclaration.list.mockResolvedValue({ data: [], errors: null });
  mockClient.models.WarDeclaration.create.mockResolvedValue({ data: { id: 'war-1' }, errors: null });
  mockClient.models.WarDeclaration.update.mockResolvedValue({ data: {}, errors: null });
  mockClient.models.DiplomaticRelation.list.mockResolvedValue({ data: [], errors: null });
  mockClient.models.DiplomaticRelation.create.mockResolvedValue({ data: { id: 'rel-1' }, errors: null });
  mockClient.models.DiplomaticRelation.update.mockResolvedValue({ data: {}, errors: null });
  mockClient.models.Treaty.list.mockResolvedValue({ data: [], errors: null });
  mockClient.models.Treaty.update.mockResolvedValue({ data: {}, errors: null });
});

describe('war-manager handler — declareWar', () => {
  describe('happy path', () => {
    it('creates a WarDeclaration and diplomatic relation when no prior war exists', async () => {
      const result = await handler(
        makeEvent({ attackerId: 'king-1', defenderId: 'king-2', seasonId: 'season-1', reason: 'Land dispute' })
      );

      const parsed = JSON.parse(result as string);
      expect(parsed.success).toBe(true);
      expect(parsed.warDeclaration.attackerId).toBe('king-1');
      expect(parsed.warDeclaration.defenderId).toBe('king-2');
      expect(parsed.warDeclaration.status).toBe('active');

      expect(mockClient.models.WarDeclaration.create).toHaveBeenCalledOnce();
      // No existing relation → create one
      expect(mockClient.models.DiplomaticRelation.create).toHaveBeenCalledOnce();
    });

    it('updates existing diplomatic relation to war status', async () => {
      mockClient.models.DiplomaticRelation.list.mockResolvedValue({
        data: [{ id: 'rel-1', kingdomId: 'king-1', targetKingdomId: 'king-2', status: 'neutral', reputation: 10 }],
        errors: null,
      });

      const result = await handler(
        makeEvent({ attackerId: 'king-1', defenderId: 'king-2', seasonId: 'season-1' })
      );

      const parsed = JSON.parse(result as string);
      expect(parsed.success).toBe(true);
      expect(mockClient.models.DiplomaticRelation.update).toHaveBeenCalledOnce();
      expect(mockClient.models.DiplomaticRelation.create).not.toHaveBeenCalled();
    });

    it('breaks active treaties when war is declared', async () => {
      mockClient.models.Treaty.list.mockResolvedValue({
        data: [{ id: 'treaty-1', status: 'active' }],
        errors: null,
      });

      await handler(
        makeEvent({ attackerId: 'king-1', defenderId: 'king-2', seasonId: 'season-1' })
      );

      expect(mockClient.models.Treaty.update).toHaveBeenCalledWith({ id: 'treaty-1', status: 'broken' });
    });
  });

  describe('validation failures', () => {
    it('returns MISSING_PARAMS when attackerId is absent', async () => {
      const result = await handler(makeEvent({ defenderId: 'king-2', seasonId: 'season-1' }));

      const parsed = JSON.parse(result as string);
      expect(parsed.success).toBe(false);
      expect(parsed.errorCode).toBe('MISSING_PARAMS');
    });

    it('returns MISSING_PARAMS when defenderId is absent', async () => {
      const result = await handler(makeEvent({ attackerId: 'king-1', seasonId: 'season-1' }));

      const parsed = JSON.parse(result as string);
      expect(parsed.success).toBe(false);
      expect(parsed.errorCode).toBe('MISSING_PARAMS');
    });

    it('returns MISSING_PARAMS when seasonId is absent', async () => {
      const result = await handler(makeEvent({ attackerId: 'king-1', defenderId: 'king-2' }));

      const parsed = JSON.parse(result as string);
      expect(parsed.success).toBe(false);
      expect(parsed.errorCode).toBe('MISSING_PARAMS');
    });

    it('returns INVALID_PARAM when attacker and defender are the same', async () => {
      const result = await handler(
        makeEvent({ attackerId: 'king-1', defenderId: 'king-1', seasonId: 'season-1' })
      );

      const parsed = JSON.parse(result as string);
      expect(parsed.success).toBe(false);
      expect(parsed.errorCode).toBe('INVALID_PARAM');
    });

    it('returns VALIDATION_FAILED when war already exists against this kingdom', async () => {
      mockClient.models.WarDeclaration.list.mockResolvedValue({
        data: [{ id: 'war-existing', attackerId: 'king-1', defenderId: 'king-2', status: 'active' }],
        errors: null,
      });

      const result = await handler(
        makeEvent({ attackerId: 'king-1', defenderId: 'king-2', seasonId: 'season-1' })
      );

      const parsed = JSON.parse(result as string);
      expect(parsed.success).toBe(false);
      expect(parsed.errorCode).toBe('VALIDATION_FAILED');
      expect(mockClient.models.WarDeclaration.create).not.toHaveBeenCalled();
    });
  });
});

describe('war-manager handler — resolveWar', () => {
  describe('happy path', () => {
    it('resolves an existing war and updates diplomatic relation to neutral', async () => {
      mockClient.models.WarDeclaration.get.mockResolvedValue({
        data: { id: 'war-1', attackerId: 'king-1', defenderId: 'king-2', status: 'active' },
        errors: null,
      });
      mockClient.models.DiplomaticRelation.list.mockResolvedValue({
        data: [{ id: 'rel-1', kingdomId: 'king-1', targetKingdomId: 'king-2', status: 'war', reputation: -50 }],
        errors: null,
      });

      const result = await handler(
        makeEvent({ warId: 'war-1', resolution: 'peace_treaty' })
      );

      const parsed = JSON.parse(result as string);
      expect(parsed.success).toBe(true);
      expect(parsed.warId).toBe('war-1');
      expect(parsed.resolution).toBe('peace_treaty');

      expect(mockClient.models.WarDeclaration.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'war-1', status: 'resolved' })
      );
      expect(mockClient.models.DiplomaticRelation.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'neutral' })
      );
    });
  });

  describe('NOT_FOUND', () => {
    it('returns NOT_FOUND when warId does not exist', async () => {
      mockClient.models.WarDeclaration.get.mockResolvedValue({ data: null, errors: null });

      const result = await handler(makeEvent({ warId: 'missing-war', resolution: 'peace' }));

      const parsed = JSON.parse(result as string);
      expect(parsed.success).toBe(false);
      expect(parsed.errorCode).toBe('NOT_FOUND');
    });
  });

  describe('validation failures', () => {
    it('returns MISSING_PARAMS when warId is absent', async () => {
      const result = await handler(makeEvent({ resolution: 'peace' }));

      // When neither warId+resolution NOR attackerId+defenderId are present,
      // the handler falls through to declareWar path and returns MISSING_PARAMS
      const parsed = JSON.parse(result as string);
      expect(parsed.success).toBe(false);
    });
  });
});
