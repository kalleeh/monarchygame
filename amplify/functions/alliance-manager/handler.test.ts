import { vi, describe, it, expect, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock aws-amplify/data before importing the handler
// ---------------------------------------------------------------------------

const mockClient = vi.hoisted(() => ({
  models: {
    Kingdom: { get: vi.fn(), update: vi.fn() },
    Alliance: { get: vi.fn(), update: vi.fn(), create: vi.fn(), delete: vi.fn() },
    AllianceInvitation: { list: vi.fn(), update: vi.fn(), create: vi.fn() },
  },
}));

vi.mock('aws-amplify/data', () => ({
  generateClient: () => mockClient,
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

function makeEvent(args: Record<string, unknown>, identity?: { sub?: string; username?: string } | null) {
  return {
    arguments: args,
    identity: identity !== undefined ? identity : { sub: 'test-sub-123', username: 'test-user' },
  } as any;
}

function mockKingdom(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      id: 'kingdom-1',
      owner: 'test-sub-123',
      resources: { gold: 10000, population: 1000, mana: 500, land: 1000 },
      stats: {},
      race: 'Human',
      ...overrides,
    },
    errors: null,
  };
}

function mockAlliance(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      id: 'alliance-1',
      name: 'Test Alliance',
      leaderId: 'kingdom-1',
      memberIds: JSON.stringify(['kingdom-1']),
      maxMembers: 20,
      isPublic: true,
      owner: 'test-sub-123',
      ...overrides,
    },
    errors: null,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockClient.models.Kingdom.update.mockResolvedValue({ data: {}, errors: null });
  mockClient.models.Alliance.update.mockResolvedValue({ data: {}, errors: null });
  mockClient.models.Alliance.create.mockResolvedValue({ data: { id: 'new-alliance-1' }, errors: null });
  mockClient.models.Alliance.delete.mockResolvedValue({ data: {}, errors: null });
  mockClient.models.AllianceInvitation.list.mockResolvedValue({ data: [], errors: null });
  mockClient.models.AllianceInvitation.update.mockResolvedValue({ data: {}, errors: null });
  mockClient.models.AllianceInvitation.create.mockResolvedValue({ data: { id: 'inv-1' }, errors: null });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('alliance-manager handler', () => {
  describe('decline', () => {
    it('marks invitation as declined', async () => {
      mockClient.models.Kingdom.get.mockResolvedValue(mockKingdom());
      mockClient.models.AllianceInvitation.list.mockResolvedValue({
        data: [{ id: 'inv-1', status: 'pending', guildId: 'alliance-1', inviteeId: 'kingdom-1' }],
        errors: null,
      });

      const result = await callHandler(
        makeEvent({ action: 'decline', allianceId: 'alliance-1', kingdomId: 'kingdom-1' })
      );

      expect(result.success).toBe(true);
      expect(mockClient.models.AllianceInvitation.update).toHaveBeenCalledWith({
        id: 'inv-1',
        status: 'declined',
      });

      const parsed = JSON.parse((result as any).result as string);
      expect(parsed.action).toBe('decline');
      expect(parsed.allianceId).toBe('alliance-1');
    });

    it('succeeds even when no pending invitation exists', async () => {
      mockClient.models.Kingdom.get.mockResolvedValue(mockKingdom());
      mockClient.models.AllianceInvitation.list.mockResolvedValue({ data: [], errors: null });

      const result = await callHandler(
        makeEvent({ action: 'decline', allianceId: 'alliance-1', kingdomId: 'kingdom-1' })
      );

      expect(result.success).toBe(true);
      expect(mockClient.models.AllianceInvitation.update).not.toHaveBeenCalled();
    });

    it('returns MISSING_PARAMS when allianceId is absent', async () => {
      const result = await callHandler(
        makeEvent({ action: 'decline', kingdomId: 'kingdom-1' })
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('MISSING_PARAMS');
    });

    it('returns FORBIDDEN when kingdom is not owned by caller', async () => {
      mockClient.models.Kingdom.get.mockResolvedValue(mockKingdom({ owner: 'other-sub-999' }));

      const result = await callHandler(
        makeEvent({ action: 'decline', allianceId: 'alliance-1', kingdomId: 'kingdom-1' })
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('FORBIDDEN');
      expect(mockClient.models.AllianceInvitation.update).not.toHaveBeenCalled();
    });
  });

  describe('join with invitation acceptance', () => {
    it('marks pending invitation as accepted when joining', async () => {
      mockClient.models.Kingdom.get.mockResolvedValue(mockKingdom());
      mockClient.models.Alliance.get.mockResolvedValue(
        mockAlliance({ isPublic: true, memberIds: JSON.stringify([]) })
      );
      mockClient.models.AllianceInvitation.list.mockResolvedValue({
        data: [{ id: 'inv-1', status: 'pending', guildId: 'alliance-1', inviteeId: 'kingdom-1' }],
        errors: null,
      });

      const result = await callHandler(
        makeEvent({ action: 'join', allianceId: 'alliance-1', kingdomId: 'kingdom-1' })
      );

      expect(result.success).toBe(true);
      expect(mockClient.models.AllianceInvitation.update).toHaveBeenCalledWith({
        id: 'inv-1',
        status: 'accepted',
      });
    });

    it('succeeds without updating invitation when none exists', async () => {
      mockClient.models.Kingdom.get.mockResolvedValue(mockKingdom());
      mockClient.models.Alliance.get.mockResolvedValue(
        mockAlliance({ isPublic: true, memberIds: JSON.stringify([]) })
      );
      mockClient.models.AllianceInvitation.list.mockResolvedValue({ data: [], errors: null });

      const result = await callHandler(
        makeEvent({ action: 'join', allianceId: 'alliance-1', kingdomId: 'kingdom-1' })
      );

      expect(result.success).toBe(true);
      expect(mockClient.models.AllianceInvitation.update).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('creates an alliance and returns allianceId', async () => {
      mockClient.models.Kingdom.get.mockResolvedValue(mockKingdom());

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
      mockClient.models.Kingdom.get.mockResolvedValue(mockKingdom());
      mockClient.models.Alliance.get.mockResolvedValue(
        mockAlliance({ memberIds: JSON.stringify(['kingdom-1', 'kingdom-2']), leaderId: 'kingdom-2' })
      );

      const result = await callHandler(
        makeEvent({ action: 'leave', allianceId: 'alliance-1', kingdomId: 'kingdom-1' })
      );

      expect(result.success).toBe(true);
      const updateCall = mockClient.models.Alliance.update.mock.calls[0][0];
      const updatedMembers = JSON.parse(updateCall.memberIds);
      expect(updatedMembers).not.toContain('kingdom-1');
    });

    it('dissolves alliance when last member leaves', async () => {
      mockClient.models.Kingdom.get.mockResolvedValue(mockKingdom());
      mockClient.models.Alliance.get.mockResolvedValue(
        mockAlliance({ memberIds: JSON.stringify(['kingdom-1']), leaderId: 'kingdom-1' })
      );

      const result = await callHandler(
        makeEvent({ action: 'leave', allianceId: 'alliance-1', kingdomId: 'kingdom-1' })
      );

      expect(result.success).toBe(true);
      const parsed = JSON.parse((result as any).result as string);
      expect(parsed.dissolved).toBe(true);
      expect(mockClient.models.Alliance.delete).toHaveBeenCalledWith({ id: 'alliance-1' });
    });
  });

  describe('kick', () => {
    it('removes target from alliance when caller is leader', async () => {
      mockClient.models.Kingdom.get.mockResolvedValue(mockKingdom());
      mockClient.models.Alliance.get.mockResolvedValue(
        mockAlliance({ memberIds: JSON.stringify(['kingdom-1', 'kingdom-2']), leaderId: 'kingdom-1' })
      );

      const result = await callHandler(
        makeEvent({ action: 'kick', allianceId: 'alliance-1', kingdomId: 'kingdom-1', targetKingdomId: 'kingdom-2' })
      );

      expect(result.success).toBe(true);
      const parsed = JSON.parse((result as any).result as string);
      expect(parsed.kickedKingdomId).toBe('kingdom-2');
    });

    it('returns FORBIDDEN when caller is not leader', async () => {
      mockClient.models.Kingdom.get.mockResolvedValue(mockKingdom());
      mockClient.models.Alliance.get.mockResolvedValue(
        mockAlliance({ memberIds: JSON.stringify(['kingdom-1', 'kingdom-2']), leaderId: 'kingdom-2' })
      );

      const result = await callHandler(
        makeEvent({ action: 'kick', allianceId: 'alliance-1', kingdomId: 'kingdom-1', targetKingdomId: 'kingdom-2' })
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('FORBIDDEN');
    });
  });

  describe('invite', () => {
    it('creates an invitation when caller is leader', async () => {
      mockClient.models.Kingdom.get.mockResolvedValue(mockKingdom());
      mockClient.models.Alliance.get.mockResolvedValue(
        mockAlliance({ leaderId: 'kingdom-1' })
      );

      const result = await callHandler(
        makeEvent({ action: 'invite', allianceId: 'alliance-1', kingdomId: 'kingdom-1', targetKingdomId: 'kingdom-2' })
      );

      expect(result.success).toBe(true);
      expect(mockClient.models.AllianceInvitation.create).toHaveBeenCalledWith(
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
