import { vi, describe, it, expect, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock ../data-client before importing the handler
// ---------------------------------------------------------------------------

const mockDbGet = vi.hoisted(() => vi.fn());
const mockDbList = vi.hoisted(() => vi.fn());
const mockDbDelete = vi.hoisted(() => vi.fn());
const mockDbQuery = vi.hoisted(() => vi.fn());

vi.mock('../data-client', () => ({
  dbGet: mockDbGet,
  dbList: mockDbList,
  dbDelete: mockDbDelete,
  dbQuery: mockDbQuery,
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

interface DeletedCounts {
  territories: number;
  restorationStatuses: number;
  combatNotifications: number;
  battleReports: number;
  warDeclarations: number;
  tradeOffers: number;
  diplomaticRelations: number;
  treaties: number;
  allianceInvitations: number;
}

interface HandlerResult {
  success: boolean;
  deleted?: DeletedCounts;
  error?: string | null;
  errorCode?: string | null;
}

const callHandler = handler as unknown as (event: unknown) => Promise<HandlerResult>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(args: Record<string, unknown>, identityOverrides: Record<string, unknown> = {}) {
  return {
    arguments: args,
    identity: { sub: 'owner-sub-123', username: 'owner-user', ...identityOverrides },
  };
}

function mockKingdom(overrides: Record<string, unknown> = {}) {
  return {
    id: 'kingdom-1',
    owner: 'owner-sub-123',
    name: 'Test Kingdom',
    race: 'Human',
    ...overrides,
  };
}

// Default empty lists for all models
function setupEmptyLists() {
  mockDbList.mockResolvedValue([]);
  mockDbQuery.mockResolvedValue([]);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockDbDelete.mockResolvedValue(undefined);
  setupEmptyLists();
});

describe('kingdom-cleanup handler', () => {
  describe('happy path', () => {
    it('deletes kingdom and all related records, returns correct counts', async () => {
      mockDbGet.mockResolvedValue(mockKingdom());
      mockDbQuery.mockImplementation(async (model: string) => {
        switch (model) {
          case 'Territory':
            return [
              { id: 'terr-1', kingdomId: 'kingdom-1' },
              { id: 'terr-2', kingdomId: 'kingdom-1' },
            ];
          case 'RestorationStatus':
            return [{ id: 'rest-1', kingdomId: 'kingdom-1' }];
          case 'CombatNotification':
            return [{ id: 'notif-1', attackerId: 'kingdom-1' }, { id: 'notif-2', defenderId: 'kingdom-1' }];
          case 'BattleReport':
            return [{ id: 'br-1', attackerId: 'kingdom-1' }, { id: 'br-2', defenderId: 'kingdom-1' }];
          case 'WarDeclaration':
            return [{ id: 'war-1', attackerId: 'kingdom-1' }];
          case 'TradeOffer':
            return [{ id: 'trade-1', sellerId: 'kingdom-1' }];
          case 'DiplomaticRelation':
            return [{ id: 'dip-1', kingdomId: 'kingdom-1' }, { id: 'dip-2', targetKingdomId: 'kingdom-1' }];
          case 'Treaty':
            return [{ id: 'treaty-1', proposerId: 'kingdom-1' }];
          case 'AllianceInvitation':
            return [{ id: 'inv-1', targetKingdomId: 'kingdom-1' }];
          default:
            return [];
        }
      });

      const result = await callHandler(
        makeEvent({ kingdomId: 'kingdom-1', confirmation: 'DELETE' })
      );

      expect(result.success).toBe(true);
      expect(result.deleted).toMatchObject({
        territories: 2,
        restorationStatuses: 1,
        combatNotifications: 2,
        battleReports: 2,
        warDeclarations: 1,
        tradeOffers: 1,
        diplomaticRelations: 2,
        treaties: 1,
        allianceInvitations: 1,
      });

      // Kingdom itself was deleted last
      const deleteCallArgs = mockDbDelete.mock.calls.map((c: unknown[]) => [c[0], c[1]]);
      expect(deleteCallArgs).toContainEqual(['Kingdom', 'kingdom-1']);
      // Kingdom delete should be last
      const kingdomDeleteIdx = mockDbDelete.mock.calls.findIndex((c: unknown[]) => c[0] === 'Kingdom' && c[1] === 'kingdom-1');
      expect(kingdomDeleteIdx).toBe(mockDbDelete.mock.calls.length - 1);
    });

    it('succeeds with zero related records', async () => {
      mockDbGet.mockResolvedValue(mockKingdom());
      // mockDbList already returns [] by default

      const result = await callHandler(
        makeEvent({ kingdomId: 'kingdom-1', confirmation: 'DELETE' })
      );

      expect(result.success).toBe(true);
      expect(result.deleted?.territories).toBe(0);
      expect(result.deleted?.battleReports).toBe(0);
      // Only the Kingdom itself deleted
      expect(mockDbDelete).toHaveBeenCalledTimes(1);
      expect(mockDbDelete).toHaveBeenCalledWith('Kingdom', 'kingdom-1');
    });
  });

  describe('missing params', () => {
    it('returns MISSING_PARAMS when kingdomId is absent', async () => {
      const result = await callHandler(makeEvent({ confirmation: 'DELETE' }));
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('MISSING_PARAMS');
    });

    it('returns MISSING_PARAMS when confirmation is absent', async () => {
      const result = await callHandler(makeEvent({ kingdomId: 'kingdom-1' }));
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('MISSING_PARAMS');
    });
  });

  describe('invalid confirmation', () => {
    it('returns INVALID_PARAM when confirmation is not "DELETE"', async () => {
      const result = await callHandler(makeEvent({ kingdomId: 'kingdom-1', confirmation: 'delete' }));
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_PARAM');
    });

    it('returns INVALID_PARAM when confirmation is a different string', async () => {
      const result = await callHandler(makeEvent({ kingdomId: 'kingdom-1', confirmation: 'yes' }));
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_PARAM');
    });
  });

  describe('ownership check', () => {
    it('returns FORBIDDEN when caller does not own the kingdom', async () => {
      mockDbGet.mockResolvedValue(mockKingdom({ owner: 'other-sub-999' }));

      const result = await callHandler(
        makeEvent({ kingdomId: 'kingdom-1', confirmation: 'DELETE' }, { sub: 'intruder-sub', username: 'intruder' })
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('FORBIDDEN');
      expect(mockDbDelete).not.toHaveBeenCalled();
    });
  });

  describe('kingdom not found', () => {
    it('returns NOT_FOUND when kingdom does not exist', async () => {
      mockDbGet.mockResolvedValue(null);

      const result = await callHandler(
        makeEvent({ kingdomId: 'missing-id', confirmation: 'DELETE' })
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('NOT_FOUND');
      expect(mockDbDelete).not.toHaveBeenCalled();
    });
  });
});
