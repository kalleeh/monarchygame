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
    Treaty: {
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
    WarDeclaration: {
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
  mockClient.models.Treaty.list.mockResolvedValue({ data: [], errors: null });
  mockClient.models.Treaty.create.mockResolvedValue({ data: { id: 'treaty-1' }, errors: null });
  mockClient.models.Treaty.update.mockResolvedValue({ data: {}, errors: null });
  mockClient.models.DiplomaticRelation.list.mockResolvedValue({ data: [], errors: null });
  mockClient.models.DiplomaticRelation.create.mockResolvedValue({ data: { id: 'rel-1' }, errors: null });
  mockClient.models.DiplomaticRelation.update.mockResolvedValue({ data: {}, errors: null });
  mockClient.models.WarDeclaration.list.mockResolvedValue({ data: [], errors: null });
  mockClient.models.WarDeclaration.update.mockResolvedValue({ data: {}, errors: null });
});

describe('diplomacy-processor handler — sendTreatyProposal', () => {
  describe('happy path', () => {
    it('creates a treaty proposal and returns proposed status', async () => {
      const result = await handler(
        makeEvent({
          proposerId: 'king-1',
          recipientId: 'king-2',
          seasonId: 'season-1',
          treatyType: 'non_aggression',
          terms: { noAttack: true },
        })
      );

      const parsed = JSON.parse(result as string);
      expect(parsed.success).toBe(true);
      expect(parsed.treaty.proposerId).toBe('king-1');
      expect(parsed.treaty.recipientId).toBe('king-2');
      expect(parsed.treaty.type).toBe('non_aggression');
      expect(parsed.treaty.status).toBe('proposed');

      expect(mockClient.models.Treaty.create).toHaveBeenCalledOnce();
    });

    it('works for all treaty types', async () => {
      const types = ['non_aggression', 'trade_agreement', 'military_alliance', 'ceasefire'];
      for (const treatyType of types) {
        vi.clearAllMocks();
        mockClient.models.Treaty.list.mockResolvedValue({ data: [], errors: null });
        mockClient.models.Treaty.create.mockResolvedValue({ data: { id: 'treaty-x' }, errors: null });

        const result = await handler(
          makeEvent({ proposerId: 'king-1', recipientId: 'king-2', seasonId: 'season-1', treatyType })
        );

        const parsed = JSON.parse(result as string);
        expect(parsed.success).toBe(true);
      }
    });
  });

  describe('validation failures', () => {
    it('returns MISSING_PARAMS when proposerId is absent', async () => {
      const result = await handler(
        makeEvent({ recipientId: 'king-2', seasonId: 'season-1', treatyType: 'non_aggression' })
      );

      const parsed = JSON.parse(result as string);
      expect(parsed.success).toBe(false);
      expect(parsed.errorCode).toBe('MISSING_PARAMS');
    });

    it('returns MISSING_PARAMS when seasonId is absent', async () => {
      // No treatyId, no kingdomId → falls to sendTreatyProposal which requires seasonId
      const result = await handler(
        makeEvent({ proposerId: 'king-1', recipientId: 'king-2', treatyType: 'ceasefire' })
      );

      const parsed = JSON.parse(result as string);
      expect(parsed.success).toBe(false);
      expect(parsed.errorCode).toBe('MISSING_PARAMS');
    });

    it('returns INVALID_PARAM when proposer and recipient are the same', async () => {
      const result = await handler(
        makeEvent({ proposerId: 'king-1', recipientId: 'king-1', seasonId: 'season-1', treatyType: 'non_aggression' })
      );

      const parsed = JSON.parse(result as string);
      expect(parsed.success).toBe(false);
      expect(parsed.errorCode).toBe('INVALID_PARAM');
    });

    it('returns TREATY_CONFLICT when a pending proposal already exists', async () => {
      mockClient.models.Treaty.list.mockResolvedValue({
        data: [{ id: 'existing-treaty', status: 'proposed' }],
        errors: null,
      });

      const result = await handler(
        makeEvent({ proposerId: 'king-1', recipientId: 'king-2', seasonId: 'season-1', treatyType: 'non_aggression' })
      );

      const parsed = JSON.parse(result as string);
      expect(parsed.success).toBe(false);
      expect(parsed.errorCode).toBe('TREATY_CONFLICT');
      expect(mockClient.models.Treaty.create).not.toHaveBeenCalled();
    });
  });
});

describe('diplomacy-processor handler — respondToTreaty', () => {
  it('accepts a treaty proposal and updates diplomatic relation', async () => {
    mockClient.models.Treaty.get.mockResolvedValue({
      data: { id: 'treaty-1', proposerId: 'king-1', recipientId: 'king-2', status: 'proposed', type: 'non_aggression' },
      errors: null,
    });

    const result = await handler(makeEvent({ treatyId: 'treaty-1', accepted: true }));

    const parsed = JSON.parse(result as string);
    expect(parsed.success).toBe(true);
    expect(parsed.accepted).toBe(true);
    expect(parsed.status).toBe('active');

    expect(mockClient.models.Treaty.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'treaty-1', status: 'active' })
    );
  });

  it('rejects a treaty proposal and marks it as expired', async () => {
    mockClient.models.Treaty.get.mockResolvedValue({
      data: { id: 'treaty-1', proposerId: 'king-1', recipientId: 'king-2', status: 'proposed', type: 'ceasefire' },
      errors: null,
    });

    const result = await handler(makeEvent({ treatyId: 'treaty-1', accepted: false }));

    const parsed = JSON.parse(result as string);
    expect(parsed.success).toBe(true);
    expect(parsed.accepted).toBe(false);
    expect(parsed.status).toBe('expired');
  });

  it('returns NOT_FOUND when treaty does not exist', async () => {
    mockClient.models.Treaty.get.mockResolvedValue({ data: null, errors: null });

    const result = await handler(makeEvent({ treatyId: 'ghost-treaty', accepted: true }));

    const parsed = JSON.parse(result as string);
    expect(parsed.success).toBe(false);
    expect(parsed.errorCode).toBe('NOT_FOUND');
  });

  it('returns VALIDATION_FAILED when treaty is no longer in proposed status', async () => {
    mockClient.models.Treaty.get.mockResolvedValue({
      data: { id: 'treaty-1', status: 'active' },
      errors: null,
    });

    const result = await handler(makeEvent({ treatyId: 'treaty-1', accepted: true }));

    const parsed = JSON.parse(result as string);
    expect(parsed.success).toBe(false);
    expect(parsed.errorCode).toBe('VALIDATION_FAILED');
  });
});

describe('diplomacy-processor handler — declareDiplomaticWar', () => {
  it('breaks active treaties and sets diplomatic relation to war', async () => {
    mockClient.models.Treaty.list.mockResolvedValue({
      data: [{ id: 'treaty-1', status: 'active' }],
      errors: null,
    });
    mockClient.models.DiplomaticRelation.list.mockResolvedValue({
      data: [{ id: 'rel-1', reputation: 20 }],
      errors: null,
    });

    const result = await handler(
      makeEvent({ kingdomId: 'king-1', targetKingdomId: 'king-2', seasonId: 'season-1' })
    );

    const parsed = JSON.parse(result as string);
    expect(parsed.success).toBe(true);
    expect(parsed.status).toBe('war');
    expect(mockClient.models.Treaty.update).toHaveBeenCalledWith({ id: 'treaty-1', status: 'broken' });
  });
});

describe('diplomacy-processor handler — makePeace', () => {
  it('resolves active wars and sets relation to neutral', async () => {
    mockClient.models.WarDeclaration.list.mockResolvedValue({
      data: [{ id: 'war-1', status: 'active' }],
      errors: null,
    });
    mockClient.models.DiplomaticRelation.list.mockResolvedValue({
      data: [{ id: 'rel-1', reputation: -30 }],
      errors: null,
    });

    const result = await handler(makeEvent({ kingdomId: 'king-1', targetKingdomId: 'king-2' }));

    const parsed = JSON.parse(result as string);
    expect(parsed.success).toBe(true);
    expect(parsed.status).toBe('neutral');
    expect(mockClient.models.WarDeclaration.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'war-1', status: 'resolved' })
    );
  });
});
