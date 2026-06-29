import { vi, describe, it, expect, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock ../data-client before importing the handler
// ---------------------------------------------------------------------------

const mockDbGet = vi.hoisted(() => vi.fn());
const mockDbUpdate = vi.hoisted(() => vi.fn());
const mockDbConditionalUpdate = vi.hoisted(() => vi.fn());
const mockDbCreate = vi.hoisted(() => vi.fn());
const mockDbList = vi.hoisted(() => vi.fn());
const mockDbDelete = vi.hoisted(() => vi.fn());
const mockDbAtomicAdd = vi.hoisted(() => vi.fn());
const mockDbQuery = vi.hoisted(() => vi.fn());

vi.mock('../data-client', () => ({
  persistErrorLog: vi.fn().mockResolvedValue(undefined),
  dbGet: mockDbGet,
  dbUpdate: mockDbUpdate,
  dbConditionalUpdate: mockDbConditionalUpdate,
  dbCreate: mockDbCreate,
  dbList: mockDbList,
  dbDelete: mockDbDelete,
  dbAtomicAdd: mockDbAtomicAdd,
  dbQuery: mockDbQuery,
  parseJsonField: <T>(value: unknown, defaultValue: T): T => {
    if (value === null || value === undefined) return defaultValue;
    if (typeof value === 'string') { try { return JSON.parse(value) as T; } catch { return defaultValue; } }
    return value as T;
  },
  ensureTurnsBalance: vi.fn().mockResolvedValue(undefined),
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

function makeEvent(args: Record<string, unknown>, fieldName?: string) {
  return {
    arguments: args,
    identity: { sub: 'test-sub-123', username: 'test-user' },
    ...(fieldName ? { info: { fieldName } } : {}),
  } as any;
}

function mockKingdom(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    owner: 'test-sub-123',
    resources: { gold: 10000, population: 5000, mana: 500, land: 1000 },
    buildings: {},
    totalUnits: { infantry: 100, archers: 0, cavalry: 0, siege: 0, mages: 0, scouts: 500 },
    stats: {},
    race: 'Human',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockDbUpdate.mockResolvedValue(undefined);
  mockDbConditionalUpdate.mockResolvedValue(undefined);
  mockDbList.mockResolvedValue([]);
  mockDbQuery.mockResolvedValue([]);
});

describe('thievery-processor handler', () => {
  describe('happy path — scout operation', () => {
    it('applies scout casualties regardless of success and returns operation result', async () => {
      mockDbGet
        .mockResolvedValueOnce(mockKingdom('kingdom-1'))   // attacker
        .mockResolvedValueOnce(mockKingdom('target-1'));    // target

      const result = await callHandler(
        makeEvent({ kingdomId: 'kingdom-1', operation: 'scout', targetKingdomId: 'target-1' })
      );

      expect(result.success).toBe(true);
      const parsed = JSON.parse(result.result as string);
      expect(parsed.operation).toBe('scout');
      expect(typeof parsed.succeeded).toBe('boolean');
      expect(parsed.casualties).toBeGreaterThanOrEqual(0);

      // Attacker units updated (casualty deduction)
      expect(mockDbConditionalUpdate).toHaveBeenCalled();
    });
  });

  describe('happy path — steal operation', () => {
    it('transfers gold from target to attacker on successful steal', async () => {
      // Force success by making attacker have far more scouts than target
      mockDbGet
        .mockResolvedValueOnce(
          mockKingdom('kingdom-1', { totalUnits: { scouts: 10000 } })
        )
        .mockResolvedValueOnce(
          mockKingdom('target-1', {
            resources: { gold: 100000, population: 5000, mana: 500, land: 1000 },
            totalUnits: { scouts: 0 },
          })
        );

      // Mock Math.random to always return 1 so detection rate check is always passed
      vi.spyOn(Math, 'random').mockReturnValue(1);

      const result = await callHandler(
        makeEvent({ kingdomId: 'kingdom-1', operation: 'steal', targetKingdomId: 'target-1' })
      );

      expect(result.success).toBe(true);
      // Restore Math.random
      vi.restoreAllMocks();
    });
  });

  describe('validation failures', () => {
    it('returns MISSING_PARAMS when kingdomId is absent', async () => {
      const result = await callHandler(
        makeEvent({ operation: 'scout', targetKingdomId: 'target-1' })
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('MISSING_PARAMS');
    });

    it('returns MISSING_PARAMS when targetKingdomId is absent', async () => {
      const result = await callHandler(
        makeEvent({ kingdomId: 'kingdom-1', operation: 'scout' })
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('MISSING_PARAMS');
    });

    it('returns INVALID_PARAM for an invalid operation', async () => {
      const result = await callHandler(
        makeEvent({ kingdomId: 'kingdom-1', operation: 'ninja_stuff', targetKingdomId: 'target-1' })
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_PARAM');
    });

    it('returns INVALID_PARAM when operation is absent', async () => {
      const result = await callHandler(
        makeEvent({ kingdomId: 'kingdom-1', targetKingdomId: 'target-1' })
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_PARAM');
    });
  });

  describe('INSUFFICIENT_RESOURCES', () => {
    it('returns INSUFFICIENT_RESOURCES when attacker has fewer than 100 scouts', async () => {
      mockDbGet.mockResolvedValueOnce(
        mockKingdom('kingdom-1', { totalUnits: { scouts: 50 } })
      );

      const result = await callHandler(
        makeEvent({ kingdomId: 'kingdom-1', operation: 'scout', targetKingdomId: 'target-1' })
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INSUFFICIENT_RESOURCES');
    });

    it('returns INSUFFICIENT_RESOURCES when attacker has exactly 0 scouts', async () => {
      mockDbGet.mockResolvedValueOnce(
        mockKingdom('kingdom-1', { totalUnits: { scouts: 0 } })
      );

      const result = await callHandler(
        makeEvent({ kingdomId: 'kingdom-1', operation: 'steal', targetKingdomId: 'target-1' })
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INSUFFICIENT_RESOURCES');
    });
  });

  describe('NOT_FOUND', () => {
    it('returns NOT_FOUND when attacker kingdom does not exist', async () => {
      mockDbGet.mockResolvedValue(null);

      const result = await callHandler(
        makeEvent({ kingdomId: 'missing-id', operation: 'scout', targetKingdomId: 'target-1' })
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('NOT_FOUND');
    });

    it('returns NOT_FOUND when target kingdom does not exist', async () => {
      mockDbGet
        .mockResolvedValueOnce(mockKingdom('kingdom-1'))
        .mockResolvedValueOnce(null);

      const result = await callHandler(
        makeEvent({ kingdomId: 'kingdom-1', operation: 'scout', targetKingdomId: 'missing-target' })
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('NOT_FOUND');
    });
  });

  describe('defender registration', () => {
    const combatNotifications = () =>
      mockDbCreate.mock.calls.filter(([model]) => model === 'CombatNotification');

    it('alerts the defender by name when the spy is detected', async () => {
      // Force detection: target has far more scum than attacker, and Math.random
      // returns 0 so `Math.random() > detectionRate` is false (detected).
      mockDbGet
        .mockResolvedValueOnce(mockKingdom('kingdom-1', { name: 'Aggressor', totalUnits: { scouts: 100 } }))
        .mockResolvedValueOnce(mockKingdom('target-1', { owner: 'defender-sub', totalUnits: { scouts: 100000 } }));
      vi.spyOn(Math, 'random').mockReturnValue(0);

      const result = await callHandler(
        makeEvent({ kingdomId: 'kingdom-1', operation: 'steal', targetKingdomId: 'target-1' })
      );

      expect(result.success).toBe(true);
      expect(JSON.parse(result.result as string).succeeded).toBe(false);

      const notifs = combatNotifications();
      expect(notifs).toHaveLength(1);
      const payload = notifs[0][1] as Record<string, unknown>;
      expect(payload.recipientId).toBe('target-1');
      expect(payload.owner).toBe('defender-sub');
      expect(payload.message).toContain('Aggressor');
      expect(JSON.parse(payload.data as string)).toMatchObject({ detected: true, attackerKingdomId: 'kingdom-1' });
      vi.restoreAllMocks();
    });

    it('sends an anonymous effect notice when an op succeeds undetected', async () => {
      mockDbGet
        .mockResolvedValueOnce(mockKingdom('kingdom-1', { name: 'Aggressor', totalUnits: { scouts: 100000 } }))
        .mockResolvedValueOnce(mockKingdom('target-1', {
          owner: 'defender-sub',
          resources: { gold: 1000000, population: 5000, mana: 500, land: 1000 },
          totalUnits: { scouts: 0 },
        }));
      vi.spyOn(Math, 'random').mockReturnValue(1); // never detected

      const result = await callHandler(
        makeEvent({ kingdomId: 'kingdom-1', operation: 'steal', targetKingdomId: 'target-1' })
      );

      expect(JSON.parse(result.result as string).succeeded).toBe(true);
      const notifs = combatNotifications();
      expect(notifs).toHaveLength(1);
      const payload = notifs[0][1] as Record<string, unknown>;
      expect(payload.recipientId).toBe('target-1');
      expect(payload.message).not.toContain('Aggressor');
      expect(String(payload.message).toLowerCase()).toContain('treasurer');
      expect(JSON.parse(payload.data as string)).toMatchObject({ detected: false });
      expect(JSON.parse(payload.data as string).attackerKingdomId).toBeUndefined();
      vi.restoreAllMocks();
    });

    it('does not notify the defender for an undetected scout (pure intel)', async () => {
      mockDbGet
        .mockResolvedValueOnce(mockKingdom('kingdom-1', { totalUnits: { scouts: 100000 } }))
        .mockResolvedValueOnce(mockKingdom('target-1', { owner: 'defender-sub', totalUnits: { scouts: 0 } }));
      vi.spyOn(Math, 'random').mockReturnValue(1); // never detected

      await callHandler(
        makeEvent({ kingdomId: 'kingdom-1', operation: 'scout', targetKingdomId: 'target-1' })
      );

      expect(combatNotifications()).toHaveLength(0);
      vi.restoreAllMocks();
    });
  });

  describe('scout intel snapshot', () => {
    const scoutIntelCreates = () => mockDbCreate.mock.calls.filter(([model]) => model === 'ScoutIntel');

    it('writes a defender snapshot on a successful scout', async () => {
      mockDbGet
        .mockResolvedValueOnce(mockKingdom('kingdom-1', { totalUnits: { scouts: 100000 } }))
        .mockResolvedValueOnce(mockKingdom('target-1', {
          name: 'Targetania',
          owner: 'defender-sub',
          race: 'Human',
          resources: { gold: 250000, population: 5000, mana: 0, land: 1800 },
          buildings: { fortress: 3 },
          totalUnits: { knights: 1000, cavalry: 500, scouts: 50 },
        }));
      vi.spyOn(Math, 'random').mockReturnValue(1); // never detected → success

      const result = await callHandler(
        makeEvent({ kingdomId: 'kingdom-1', operation: 'scout', targetKingdomId: 'target-1' })
      );

      expect(result.success).toBe(true);
      const creates = scoutIntelCreates();
      expect(creates).toHaveLength(1);
      const row = creates[0][1] as Record<string, unknown>;
      const snapshot = JSON.parse(row.defenderSnapshot as string);
      expect(snapshot.detail).toBe('full');
      expect(snapshot.totalDefense).toBeGreaterThan(0);
      expect(snapshot.fortLevel).toBe(3);
      expect(snapshot.land).toBe(1800);
      expect(snapshot.goldEstimate).toBe(250000);
      expect(snapshot.defenderName).toBe('Targetania');
      // Espionage scouts must NOT appear in the defender army snapshot.
      expect(snapshot.armyByTier.scouts).toBeUndefined();
      expect(snapshot.armyByTier.knights).toBe(1000);
      vi.restoreAllMocks();
    });

    it('scales expiry + detail with the scouter race scum (high scum = full, longer)', async () => {
      // Human scum = 4 → full detail, 39h expiry.
      mockDbGet
        .mockResolvedValueOnce(mockKingdom('kingdom-1', { race: 'Human', totalUnits: { scouts: 100000 } }))
        .mockResolvedValueOnce(mockKingdom('target-1', {
          name: 'Targetania', owner: 'defender-sub', race: 'Human',
          resources: { gold: 247000, population: 5000, mana: 0, land: 1830 },
          buildings: { fortress: 3 },
          totalUnits: { knights: 1000, cavalry: 503, scouts: 50 },
        }));
      vi.spyOn(Math, 'random').mockReturnValue(1);
      const now = Date.now();

      const result = await callHandler(
        makeEvent({ kingdomId: 'kingdom-1', operation: 'scout', targetKingdomId: 'target-1' })
      );
      expect(result.success).toBe(true);

      const row = scoutIntelCreates()[0][1] as Record<string, unknown>;
      const snapshot = JSON.parse(row.defenderSnapshot as string);
      expect(snapshot.detail).toBe('full');
      // Full intel keeps exact values + fort level.
      expect(snapshot.goldEstimate).toBe(247000);
      expect(snapshot.fortLevel).toBe(3);
      expect(snapshot.armyByTier.knights).toBe(1000);

      const expiryMs = new Date(row.expiresAt as string).getTime() - now;
      const HOUR = 3600_000;
      expect(expiryMs).toBeGreaterThan(38 * HOUR);
      expect(expiryMs).toBeLessThan(40 * HOUR);
      vi.restoreAllMocks();
    });

    it('low-scum scouter gets coarse, shorter-lived intel (banded numbers, hidden fort)', async () => {
      // Goblin scum = 2 → coarse detail, 21h expiry.
      mockDbGet
        .mockResolvedValueOnce(mockKingdom('kingdom-1', { race: 'Goblin', totalUnits: { scouts: 100000 } }))
        .mockResolvedValueOnce(mockKingdom('target-1', {
          name: 'Targetania', owner: 'defender-sub', race: 'Human',
          resources: { gold: 247000, population: 5000, mana: 0, land: 1830 },
          buildings: { fortress: 3 },
          totalUnits: { knights: 1000, cavalry: 503, scouts: 50 },
        }));
      vi.spyOn(Math, 'random').mockReturnValue(1);
      const now = Date.now();

      const result = await callHandler(
        makeEvent({ kingdomId: 'kingdom-1', operation: 'scout', targetKingdomId: 'target-1' })
      );
      expect(result.success).toBe(true);

      const row = scoutIntelCreates()[0][1] as Record<string, unknown>;
      const snapshot = JSON.parse(row.defenderSnapshot as string);
      expect(snapshot.detail).toBe('coarse');
      // Coarse: exact unit types hidden, numbers banded, fort hidden.
      expect(snapshot.armyByTier.knights).toBeUndefined();
      expect(snapshot.goldEstimate).toBe(250000); // banded from 247000
      expect(snapshot.fortLevel).toBe(-1);
      expect(snapshot.defenderName).toBe('Targetania');

      const expiryMs = new Date(row.expiresAt as string).getTime() - now;
      const HOUR = 3600_000;
      expect(expiryMs).toBeGreaterThan(20 * HOUR);
      expect(expiryMs).toBeLessThan(22 * HOUR);
      vi.restoreAllMocks();
    });
  });

  describe('shareScoutIntel', () => {
    const messageCreates = () => mockDbCreate.mock.calls.filter(([model]) => model === 'AllianceMessage');
    const freshIntel = (overrides: Record<string, unknown> = {}) => ({
      id: 'intel-1',
      scouterId: 'kingdom-1',
      targetId: 'target-1',
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      defenderSnapshot: JSON.stringify({ totalDefense: 42000, fortLevel: 2, goldEstimate: 90000, defenderName: 'Targetania' }),
      ...overrides,
    });

    it('stamps the guild id on the intel row and posts an intel message', async () => {
      mockDbGet.mockResolvedValueOnce(mockKingdom('kingdom-1', { name: 'Scouty', guildId: 'guild-9' }));
      mockDbQuery.mockResolvedValue([freshIntel()]);

      const result = await callHandler(
        makeEvent({ kingdomId: 'kingdom-1', targetKingdomId: 'target-1' }, 'shareScoutIntel')
      );

      expect(result.success).toBe(true);
      expect(mockDbUpdate).toHaveBeenCalledWith('ScoutIntel', 'intel-1', { sharedWithGuildId: 'guild-9' });
      const msgs = messageCreates();
      expect(msgs).toHaveLength(1);
      const msg = msgs[0][1] as Record<string, unknown>;
      expect(msg.guildId).toBe('guild-9');
      expect(msg.type).toBe('intel');
      expect(String(msg.content)).toContain('Targetania');
    });

    it('rejects sharing when the caller has no guild', async () => {
      mockDbGet.mockResolvedValueOnce(mockKingdom('kingdom-1', { name: 'Scouty' }));

      const result = await callHandler(
        makeEvent({ kingdomId: 'kingdom-1', targetKingdomId: 'target-1' }, 'shareScoutIntel')
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('VALIDATION_FAILED');
    });

    it('returns NOT_FOUND when there is no fresh intel on the target', async () => {
      mockDbGet.mockResolvedValueOnce(mockKingdom('kingdom-1', { guildId: 'guild-9' }));
      mockDbQuery.mockResolvedValue([freshIntel({ expiresAt: new Date(Date.now() - 1000).toISOString() })]);

      const result = await callHandler(
        makeEvent({ kingdomId: 'kingdom-1', targetKingdomId: 'target-1' }, 'shareScoutIntel')
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('NOT_FOUND');
    });
  });

  describe('detection counts both scum tiers', () => {
    it('a defender with only elite scouts can still detect the intruder', async () => {
      // Attacker has 1000 green scum; defender has 0 green but 100000 elite.
      // If elite were ignored, detectionRate would be ~0 and the op would always
      // succeed; counting elite makes detection near-certain.
      mockDbGet
        .mockResolvedValueOnce(mockKingdom('kingdom-1', { totalUnits: { scouts: 1000 } }))
        .mockResolvedValueOnce(mockKingdom('target-1', {
          owner: 'defender-sub',
          totalUnits: { scouts: 0, elite_scouts: 100000 },
        }));
      // Math.random = 0.5: detected only if detectionRate >= 0.5.
      vi.spyOn(Math, 'random').mockReturnValue(0.5);

      const result = await callHandler(
        makeEvent({ kingdomId: 'kingdom-1', operation: 'steal', targetKingdomId: 'target-1' })
      );

      expect(JSON.parse(result.result as string).succeeded).toBe(false);
      vi.restoreAllMocks();
    });
  });
});
