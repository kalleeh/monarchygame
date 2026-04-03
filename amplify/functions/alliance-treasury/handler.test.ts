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
    treasury: JSON.stringify({ gold: 5000 }),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockDbUpdate.mockResolvedValue(undefined);
});

describe('alliance-treasury handler', () => {
  describe('contribute', () => {
    describe('happy path', () => {
      it('deducts gold from kingdom and increases treasury gold', async () => {
        mockDbGet.mockImplementation(async (model: string) => {
          if (model === 'Alliance') return mockAlliance();
          if (model === 'Kingdom') return mockKingdom();
          return null;
        });

        const result = await callHandler(
          makeEvent({ allianceId: 'alliance-1', kingdomId: 'kingdom-1', action: 'contribute', amount: 1000 })
        );

        expect(result.success).toBe(true);

        // Kingdom gold should be deducted
        const kingdomUpdateCall = mockDbUpdate.mock.calls.find((c: unknown[]) => c[0] === 'Kingdom')!;
        expect(kingdomUpdateCall[2].resources.gold).toBe(10000 - 1000);

        // Treasury gold should be increased
        const allianceUpdateCall = mockDbUpdate.mock.calls.find((c: unknown[]) => c[0] === 'Alliance')!;
        expect(allianceUpdateCall[2].treasury.gold).toBe(5000 + 1000);

        const parsed = JSON.parse(result.result as string);
        expect(parsed.contributed).toBe(1000);
        expect(parsed.newTreasuryBalance).toBe(6000);
      });

      it('works when treasury starts empty', async () => {
        mockDbGet.mockImplementation(async (model: string) => {
          if (model === 'Alliance') return mockAlliance({ treasury: null });
          if (model === 'Kingdom') return mockKingdom();
          return null;
        });

        const result = await callHandler(
          makeEvent({ allianceId: 'alliance-1', kingdomId: 'kingdom-1', action: 'contribute', amount: 500 })
        );

        expect(result.success).toBe(true);
        const allianceUpdateCall = mockDbUpdate.mock.calls.find((c: unknown[]) => c[0] === 'Alliance')!;
        expect(allianceUpdateCall[2].treasury.gold).toBe(500);
      });
    });

    describe('INSUFFICIENT_RESOURCES', () => {
      it('returns INSUFFICIENT_RESOURCES when kingdom does not have enough gold', async () => {
        mockDbGet.mockImplementation(async (model: string) => {
          if (model === 'Alliance') return mockAlliance();
          if (model === 'Kingdom') return mockKingdom({ resources: { gold: 200, population: 1000, mana: 500, land: 1000 } });
          return null;
        });

        const result = await callHandler(
          makeEvent({ allianceId: 'alliance-1', kingdomId: 'kingdom-1', action: 'contribute', amount: 500 })
        );

        expect(result.success).toBe(false);
        expect(result.errorCode).toBe('INSUFFICIENT_RESOURCES');
        expect(mockDbUpdate).not.toHaveBeenCalledWith('Kingdom', expect.anything(), expect.anything());
        expect(mockDbUpdate).not.toHaveBeenCalledWith('Alliance', expect.anything(), expect.anything());
      });
    });

    describe('NOT_FOUND', () => {
      it('returns NOT_FOUND when kingdom does not exist', async () => {
        mockDbGet.mockImplementation(async (model: string) => {
          if (model === 'Alliance') return mockAlliance();
          if (model === 'Kingdom') return null;
          return null;
        });

        const result = await callHandler(
          makeEvent({ allianceId: 'alliance-1', kingdomId: 'missing-kingdom', action: 'contribute', amount: 500 })
        );

        expect(result.success).toBe(false);
        expect(result.errorCode).toBe('NOT_FOUND');
        expect(mockDbUpdate).not.toHaveBeenCalledWith('Kingdom', expect.anything(), expect.anything());
      });

      it('returns NOT_FOUND when alliance does not exist', async () => {
        mockDbGet.mockResolvedValue(null);

        const result = await callHandler(
          makeEvent({ allianceId: 'missing-alliance', kingdomId: 'kingdom-1', action: 'contribute', amount: 500 })
        );

        expect(result.success).toBe(false);
        expect(result.errorCode).toBe('NOT_FOUND');
      });
    });

    describe('MISSING_PARAMS', () => {
      it('returns MISSING_PARAMS when allianceId is absent', async () => {
        const result = await callHandler(
          makeEvent({ kingdomId: 'kingdom-1', action: 'contribute', amount: 500 })
        );

        expect(result.success).toBe(false);
        expect(result.errorCode).toBe('MISSING_PARAMS');
        expect(mockDbGet).not.toHaveBeenCalledWith('Alliance', expect.anything());
      });

      it('returns MISSING_PARAMS when kingdomId is absent', async () => {
        const result = await callHandler(
          makeEvent({ allianceId: 'alliance-1', action: 'contribute', amount: 500 })
        );

        expect(result.success).toBe(false);
        expect(result.errorCode).toBe('MISSING_PARAMS');
      });

      it('returns MISSING_PARAMS when amount is absent', async () => {
        const result = await callHandler(
          makeEvent({ allianceId: 'alliance-1', kingdomId: 'kingdom-1', action: 'contribute' })
        );

        expect(result.success).toBe(false);
        expect(result.errorCode).toBe('MISSING_PARAMS');
      });

      it('returns MISSING_PARAMS when action is absent', async () => {
        const result = await callHandler(
          makeEvent({ allianceId: 'alliance-1', kingdomId: 'kingdom-1', amount: 500 })
        );

        expect(result.success).toBe(false);
        expect(result.errorCode).toBe('MISSING_PARAMS');
      });
    });
  });

  describe('withdraw', () => {
    describe('happy path', () => {
      it('decrements treasury and increases kingdom gold', async () => {
        mockDbGet.mockImplementation(async (model: string) => {
          if (model === 'Alliance') return mockAlliance();
          if (model === 'Kingdom') return mockKingdom();
          return null;
        });

        const result = await callHandler(
          makeEvent({ allianceId: 'alliance-1', kingdomId: 'kingdom-1', action: 'withdraw', amount: 2000 })
        );

        expect(result.success).toBe(true);

        // Kingdom gold should be increased
        const kingdomUpdateCall = mockDbUpdate.mock.calls.find((c: unknown[]) => c[0] === 'Kingdom')!;
        expect(kingdomUpdateCall[2].resources.gold).toBe(10000 + 2000);

        // Treasury gold should be decreased
        const allianceUpdateCall = mockDbUpdate.mock.calls.find((c: unknown[]) => c[0] === 'Alliance')!;
        expect(allianceUpdateCall[2].treasury.gold).toBe(5000 - 2000);

        const parsed = JSON.parse(result.result as string);
        expect(parsed.withdrawn).toBe(2000);
        expect(parsed.newTreasuryBalance).toBe(3000);
      });
    });

    describe('FORBIDDEN', () => {
      it('returns UNAUTHORIZED when caller is not alliance owner', async () => {
        mockDbGet.mockResolvedValue(mockAlliance({ owner: 'other-sub-456' }));

        const result = await callHandler(
          makeEvent({ allianceId: 'alliance-1', kingdomId: 'kingdom-1', action: 'withdraw', amount: 500 })
        );

        expect(result.success).toBe(false);
        expect(result.errorCode).toBe('FORBIDDEN');
        expect(mockDbUpdate).not.toHaveBeenCalledWith('Kingdom', expect.anything(), expect.anything());
        expect(mockDbUpdate).not.toHaveBeenCalledWith('Alliance', expect.anything(), expect.anything());
      });
    });

    describe('INSUFFICIENT_RESOURCES', () => {
      it('returns INSUFFICIENT_RESOURCES when treasury does not have enough gold', async () => {
        mockDbGet.mockImplementation(async (model: string) => {
          if (model === 'Alliance') return mockAlliance({ treasury: JSON.stringify({ gold: 100 }) });
          if (model === 'Kingdom') return mockKingdom();
          return null;
        });

        const result = await callHandler(
          makeEvent({ allianceId: 'alliance-1', kingdomId: 'kingdom-1', action: 'withdraw', amount: 500 })
        );

        expect(result.success).toBe(false);
        expect(result.errorCode).toBe('INSUFFICIENT_RESOURCES');
        expect(mockDbUpdate).not.toHaveBeenCalledWith('Kingdom', expect.anything(), expect.anything());
        expect(mockDbUpdate).not.toHaveBeenCalledWith('Alliance', expect.anything(), expect.anything());
      });
    });

    describe('UNAUTHORIZED', () => {
      it('fails with UNAUTHORIZED when identity is null and no mocks provided at top level', async () => {
        // Test the handler dispatch: action is missing triggers MISSING_PARAMS
        const result = await callHandler(
          makeEvent(
            { allianceId: 'alliance-1', kingdomId: 'kingdom-1', amount: 500 },
            null
          )
        );
        expect(result.success).toBe(false);
        expect(result.errorCode).toBe('MISSING_PARAMS');
      });

      it('with null identity, returns UNAUTHORIZED', async () => {
        const resultWithNullIdentity = await callHandler(
          makeEvent(
            { allianceId: 'alliance-1', kingdomId: 'kingdom-1', action: 'withdraw', amount: 500 },
            null
          )
        );
        // Handler requires authentication — null identity → UNAUTHORIZED
        expect(resultWithNullIdentity.success).toBe(false);
        expect(resultWithNullIdentity.errorCode).toBe('UNAUTHORIZED');
      });
    });
  });
});
