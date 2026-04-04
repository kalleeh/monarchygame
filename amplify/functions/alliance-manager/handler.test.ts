import { vi, describe, it, expect, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock ../data-client before importing the handler
// ---------------------------------------------------------------------------

const mockDbGet = vi.hoisted(() => vi.fn());
const mockDbUpdate = vi.hoisted(() => vi.fn());
const mockDbCreate = vi.hoisted(() => vi.fn());
const mockDbList = vi.hoisted(() => vi.fn());
const mockDbQuery = vi.hoisted(() => vi.fn());
const mockDbDelete = vi.hoisted(() => vi.fn());
const mockDbAtomicAdd = vi.hoisted(() => vi.fn());

vi.mock('../data-client', () => ({
  dbGet: mockDbGet,
  dbUpdate: mockDbUpdate,
  dbCreate: mockDbCreate,
  dbList: mockDbList,
  dbQuery: mockDbQuery,
  dbDelete: mockDbDelete,
  dbAtomicAdd: mockDbAtomicAdd,
  parseJsonField: <T>(value: unknown, defaultValue: T): T => {
    if (value === null || value === undefined) return defaultValue;
    if (typeof value === 'string') { try { return JSON.parse(value) as T; } catch { return defaultValue; } }
    return value as T;
  },
}));

vi.mock('../rate-limiter', () => ({ checkRateLimit: vi.fn().mockResolvedValue(null) }));

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

function makeEvent(args: Record<string, unknown>, identity?: { sub?: string; username?: string } | null) {
  return {
    arguments: args,
    identity: identity !== undefined ? identity : { sub: 'test-sub-123', username: 'test-user' },
  } as any;
}

function mockKingdom(overrides: Record<string, unknown> = {}) {
  return {
    id: 'kingdom-1',
    owner: 'test-sub-123',
    resources: { gold: 10000, population: 1000, mana: 500, land: 1000 },
    stats: {},
    race: 'Human',
    ...overrides,
  };
}

function mockAlliance(overrides: Record<string, unknown> = {}) {
  return {
    id: 'alliance-1',
    name: 'Test Alliance',
    leaderId: 'kingdom-1',
    memberIds: JSON.stringify(['kingdom-1']),
    maxMembers: 20,
    isPublic: true,
    owner: 'test-sub-123',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockDbUpdate.mockResolvedValue(undefined);
  mockDbCreate.mockResolvedValue({ id: 'new-alliance-1', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), __typename: 'Alliance' });
  mockDbDelete.mockResolvedValue(undefined);
  mockDbQuery.mockResolvedValue([]);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('alliance-manager handler', () => {
  describe('decline', () => {
    it('marks invitation as declined', async () => {
      mockDbGet.mockResolvedValue(mockKingdom());
      mockDbQuery.mockResolvedValue([{ id: 'inv-1', status: 'pending', guildId: 'alliance-1', inviteeId: 'kingdom-1' }]);

      const result = await callHandler(
        makeEvent({ action: 'decline', allianceId: 'alliance-1', kingdomId: 'kingdom-1' })
      );

      expect(result.success).toBe(true);
      expect(mockDbUpdate).toHaveBeenCalledWith('AllianceInvitation', 'inv-1', { status: 'declined' });

      const parsed = JSON.parse((result as any).result as string);
      expect(parsed.action).toBe('decline');
      expect(parsed.allianceId).toBe('alliance-1');
    });

    it('succeeds even when no pending invitation exists', async () => {
      mockDbGet.mockResolvedValue(mockKingdom());
      mockDbQuery.mockResolvedValue([]);

      const result = await callHandler(
        makeEvent({ action: 'decline', allianceId: 'alliance-1', kingdomId: 'kingdom-1' })
      );

      expect(result.success).toBe(true);
      expect(mockDbUpdate).not.toHaveBeenCalledWith('AllianceInvitation', expect.anything(), expect.anything());
    });

    it('returns MISSING_PARAMS when allianceId is absent', async () => {
      const result = await callHandler(
        makeEvent({ action: 'decline', kingdomId: 'kingdom-1' })
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('MISSING_PARAMS');
    });

    it('returns FORBIDDEN when kingdom is not owned by caller', async () => {
      mockDbGet.mockResolvedValue(mockKingdom({ owner: 'other-sub-999' }));

      const result = await callHandler(
        makeEvent({ action: 'decline', allianceId: 'alliance-1', kingdomId: 'kingdom-1' })
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('FORBIDDEN');
      expect(mockDbUpdate).not.toHaveBeenCalledWith('AllianceInvitation', expect.anything(), expect.anything());
    });
  });

  describe('join with invitation acceptance', () => {
    it('marks pending invitation as accepted when joining', async () => {
      mockDbGet.mockImplementation(async (model: string) => {
        if (model === 'Kingdom') return mockKingdom();
        if (model === 'Alliance') return mockAlliance({ isPublic: true, memberIds: JSON.stringify([]) });
        return null;
      });
      mockDbQuery.mockResolvedValue([{ id: 'inv-1', status: 'pending', guildId: 'alliance-1', inviteeId: 'kingdom-1' }]);

      const result = await callHandler(
        makeEvent({ action: 'join', allianceId: 'alliance-1', kingdomId: 'kingdom-1' })
      );

      expect(result.success).toBe(true);
      expect(mockDbUpdate).toHaveBeenCalledWith('AllianceInvitation', 'inv-1', { status: 'accepted' });
    });

    it('succeeds without updating invitation when none exists', async () => {
      mockDbGet.mockImplementation(async (model: string) => {
        if (model === 'Kingdom') return mockKingdom();
        if (model === 'Alliance') return mockAlliance({ isPublic: true, memberIds: JSON.stringify([]) });
        return null;
      });
      mockDbQuery.mockResolvedValue([]);

      const result = await callHandler(
        makeEvent({ action: 'join', allianceId: 'alliance-1', kingdomId: 'kingdom-1' })
      );

      expect(result.success).toBe(true);
      expect(mockDbUpdate).not.toHaveBeenCalledWith('AllianceInvitation', expect.anything(), expect.anything());
    });
  });

  describe('create', () => {
    it('creates an alliance and returns allianceId', async () => {
      mockDbGet.mockResolvedValue(mockKingdom());

      const result = await callHandler(
        makeEvent({ action: 'create', kingdomId: 'kingdom-1', name: 'New Alliance' })
      );

      expect(result.success).toBe(true);
      const parsed = JSON.parse((result as any).result as string);
      expect(parsed.allianceId).toBe('new-alliance-1');
    });

    it('returns MISSING_PARAMS when name is absent', async () => {
      const result = await callHandler(
        makeEvent({ action: 'create', kingdomId: 'kingdom-1' })
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('MISSING_PARAMS');
    });
  });

  describe('leave', () => {
    it('removes member from alliance', async () => {
      mockDbGet.mockImplementation(async (model: string) => {
        if (model === 'Kingdom') return mockKingdom();
        if (model === 'Alliance') return mockAlliance({ memberIds: JSON.stringify(['kingdom-1', 'kingdom-2']), leaderId: 'kingdom-2' });
        return null;
      });

      const result = await callHandler(
        makeEvent({ action: 'leave', allianceId: 'alliance-1', kingdomId: 'kingdom-1' })
      );

      expect(result.success).toBe(true);
      const allianceUpdateCall = mockDbUpdate.mock.calls.find((c: unknown[]) => c[0] === 'Alliance')!;
      const updatedMembers = JSON.parse(allianceUpdateCall[2].memberIds);
      expect(updatedMembers).not.toContain('kingdom-1');
    });

    it('dissolves alliance when last member leaves', async () => {
      mockDbGet.mockImplementation(async (model: string) => {
        if (model === 'Kingdom') return mockKingdom();
        if (model === 'Alliance') return mockAlliance({ memberIds: JSON.stringify(['kingdom-1']), leaderId: 'kingdom-1' });
        return null;
      });

      const result = await callHandler(
        makeEvent({ action: 'leave', allianceId: 'alliance-1', kingdomId: 'kingdom-1' })
      );

      expect(result.success).toBe(true);
      const parsed = JSON.parse((result as any).result as string);
      expect(parsed.dissolved).toBe(true);
      expect(mockDbDelete).toHaveBeenCalledWith('Alliance', 'alliance-1');
    });
  });

  describe('kick', () => {
    it('removes target from alliance when caller is leader', async () => {
      mockDbGet.mockImplementation(async (model: string) => {
        if (model === 'Kingdom') return mockKingdom();
        if (model === 'Alliance') return mockAlliance({ memberIds: JSON.stringify(['kingdom-1', 'kingdom-2']), leaderId: 'kingdom-1' });
        return null;
      });

      const result = await callHandler(
        makeEvent({ action: 'kick', allianceId: 'alliance-1', kingdomId: 'kingdom-1', targetKingdomId: 'kingdom-2' })
      );

      expect(result.success).toBe(true);
      const parsed = JSON.parse((result as any).result as string);
      expect(parsed.kickedKingdomId).toBe('kingdom-2');
    });

    it('returns FORBIDDEN when caller is not leader', async () => {
      mockDbGet.mockImplementation(async (model: string) => {
        if (model === 'Kingdom') return mockKingdom();
        if (model === 'Alliance') return mockAlliance({ memberIds: JSON.stringify(['kingdom-1', 'kingdom-2']), leaderId: 'kingdom-2' });
        return null;
      });

      const result = await callHandler(
        makeEvent({ action: 'kick', allianceId: 'alliance-1', kingdomId: 'kingdom-1', targetKingdomId: 'kingdom-2' })
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('FORBIDDEN');
    });
  });

  describe('invite', () => {
    it('creates an invitation when caller is leader', async () => {
      mockDbGet.mockImplementation(async (model: string) => {
        if (model === 'Kingdom') return mockKingdom();
        if (model === 'Alliance') return mockAlliance({ leaderId: 'kingdom-1' });
        return null;
      });

      const result = await callHandler(
        makeEvent({ action: 'invite', allianceId: 'alliance-1', kingdomId: 'kingdom-1', targetKingdomId: 'kingdom-2' })
      );

      expect(result.success).toBe(true);
      expect(mockDbCreate).toHaveBeenCalledWith(
        'AllianceInvitation',
        expect.objectContaining({
          guildId: 'alliance-1',
          inviterId: 'kingdom-1',
          inviteeId: 'kingdom-2',
          status: 'pending',
        })
      );
    });
  });

  describe('invalid action', () => {
    it('returns INVALID_PARAM for unknown action', async () => {
      const result = await callHandler(
        makeEvent({ action: 'unknown-action', kingdomId: 'kingdom-1' })
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_PARAM');
    });
  });

  describe('authentication', () => {
    it('returns UNAUTHORIZED when identity has no sub', async () => {
      const result = await callHandler(
        makeEvent({ action: 'decline', allianceId: 'alliance-1', kingdomId: 'kingdom-1' }, { sub: undefined })
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('UNAUTHORIZED');
    });
  });
});
