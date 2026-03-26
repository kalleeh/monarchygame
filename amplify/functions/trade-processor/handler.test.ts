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

import { handler } from './handler';

// ---------------------------------------------------------------------------
// Type helpers
// ---------------------------------------------------------------------------

// Cast handler to a simple single-argument callable so tests are not burdened
// by the Amplify Gen2 / AWS Lambda 3-argument (event, context, callback)
// signature, and so that the return type is narrowed to string rather than
// the loose JSON union produced by .returns(a.json()).
const callHandler = handler as unknown as (event: unknown) => Promise<string>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(args: Record<string, unknown>) {
  return { arguments: args, identity: { sub: 'test-sub-123', username: 'test-user' } } as any;
}

function mockKingdom(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    owner: 'test-sub-123',
    resources: { gold: 50000, population: 5000, mana: 500, land: 1000 },
    buildings: {},
    totalUnits: {},
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
  mockDbCreate.mockResolvedValue({ id: 'offer-1', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), __typename: 'TradeOffer' });
  mockDbList.mockResolvedValue([]);
});

describe('trade-processor handler — createTradeOffer', () => {
  describe('happy path', () => {
    it('escrews resources, creates trade offer, and returns offer details', async () => {
      mockDbGet.mockResolvedValue(
        mockKingdom('seller-1', { resources: { gold: 50000, population: 5000, mana: 500, land: 1000 } })
      );

      const result = await callHandler(
        makeEvent({
          sellerId: 'seller-1',
          seasonId: 'season-1',
          resourceType: 'gold',
          quantity: 1000,
          pricePerUnit: 2,
        })
      );

      const parsed = JSON.parse(result as string);
      expect(parsed.success).toBe(true);
      expect(parsed.offer.sellerId).toBe('seller-1');
      expect(parsed.offer.resourceType).toBe('gold');
      expect(parsed.offer.quantity).toBe(1000);
      expect(parsed.offer.totalPrice).toBe(2000);
      expect(parsed.offer.status).toBe('open');

      // Gold escrowed: 50000 - 1000 = 49000
      const updateCall = mockDbUpdate.mock.calls[0];
      expect(updateCall[2].resources.gold).toBe(49000);
      expect(mockDbCreate).toHaveBeenCalledOnce();
    });
  });

  describe('validation failures', () => {
    it('returns MISSING_PARAMS when sellerId is absent', async () => {
      const result = await callHandler(
        makeEvent({ seasonId: 'season-1', resourceType: 'gold', quantity: 100, pricePerUnit: 5 })
      );

      const parsed = JSON.parse(result as string);
      expect(parsed.success).toBe(false);
      expect(parsed.errorCode).toBe('MISSING_PARAMS');
    });

    it('returns error when quantity is 0 or negative', async () => {
      const result = await callHandler(
        makeEvent({ sellerId: 'seller-1', seasonId: 's', resourceType: 'gold', quantity: 0, pricePerUnit: 5 })
      );

      const parsed = JSON.parse(result as string);
      expect(parsed.success).toBe(false);
    });

    it('returns INVALID_PARAM when pricePerUnit is negative', async () => {
      const result = await callHandler(
        makeEvent({ sellerId: 'seller-1', seasonId: 's', resourceType: 'gold', quantity: 100, pricePerUnit: -1 })
      );

      const parsed = JSON.parse(result as string);
      expect(parsed.success).toBe(false);
      expect(parsed.errorCode).toBe('INVALID_PARAM');
    });
  });

  describe('NOT_FOUND', () => {
    it('returns NOT_FOUND when seller kingdom does not exist', async () => {
      mockDbGet.mockResolvedValue(null);

      const result = await callHandler(
        makeEvent({ sellerId: 'ghost-seller', seasonId: 's', resourceType: 'gold', quantity: 100, pricePerUnit: 5 })
      );

      const parsed = JSON.parse(result as string);
      expect(parsed.success).toBe(false);
      expect(parsed.errorCode).toBe('NOT_FOUND');
    });
  });

  describe('INSUFFICIENT_RESOURCES', () => {
    it('returns INSUFFICIENT_RESOURCES when seller lacks the resource', async () => {
      mockDbGet.mockResolvedValue(
        mockKingdom('seller-1', { resources: { gold: 50, population: 5000, mana: 500, land: 1000 } })
      );

      const result = await callHandler(
        makeEvent({ sellerId: 'seller-1', seasonId: 's', resourceType: 'gold', quantity: 1000, pricePerUnit: 2 })
      );

      const parsed = JSON.parse(result as string);
      expect(parsed.success).toBe(false);
      expect(parsed.errorCode).toBe('INSUFFICIENT_RESOURCES');
      expect(mockDbUpdate).not.toHaveBeenCalled();
    });
  });
});

describe('trade-processor handler — acceptTradeOffer', () => {
  it('transfers resources and gold between buyer and seller', async () => {
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    let tradeOfferCallCount = 0;

    mockDbGet.mockImplementation(async (model: string, id: string) => {
      if (model === 'TradeOffer') {
        tradeOfferCallCount++;
        // First call: the open offer. Second call (after update): return with buyerId set to confirm claim.
        return {
          id: 'offer-1',
          sellerId: 'seller-1',
          resourceType: 'mana',
          quantity: 100,
          pricePerUnit: 5,
          totalPrice: 500,
          status: tradeOfferCallCount > 1 ? 'accepted' : 'open',
          buyerId: tradeOfferCallCount > 1 ? 'buyer-1' : undefined,
          expiresAt: futureDate,
        };
      }
      if (model === 'Kingdom' && id === 'buyer-1') return mockKingdom('buyer-1', { resources: { gold: 10000, population: 1000, mana: 50, land: 1000 } });
      if (model === 'Kingdom' && id === 'seller-1') return mockKingdom('seller-1', { resources: { gold: 1000, population: 1000, mana: 0, land: 1000 } });
      return null;
    });

    const result = await callHandler(makeEvent({ offerId: 'offer-1', buyerId: 'buyer-1' }));

    const parsed = JSON.parse(result as string);
    expect(parsed.success).toBe(true);
    expect(parsed.trade.buyerId).toBe('buyer-1');
    expect(parsed.trade.sellerId).toBe('seller-1');
    expect(parsed.trade.quantity).toBe(100);
    expect(parsed.trade.totalPrice).toBe(500);
  });

  it('returns INSUFFICIENT_RESOURCES when buyer cannot afford the offer', async () => {
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    mockDbGet.mockImplementation(async (model: string) => {
      if (model === 'TradeOffer') return {
        id: 'offer-1',
        sellerId: 'seller-1',
        resourceType: 'mana',
        quantity: 100,
        pricePerUnit: 5,
        totalPrice: 500,
        status: 'open',
        expiresAt: futureDate,
      };
      if (model === 'Kingdom') return mockKingdom('buyer-1', { resources: { gold: 10, population: 1000, mana: 0, land: 1000 } });
      return null;
    });

    const result = await callHandler(makeEvent({ offerId: 'offer-1', buyerId: 'buyer-1' }));

    const parsed = JSON.parse(result as string);
    expect(parsed.success).toBe(false);
    expect(parsed.errorCode).toBe('INSUFFICIENT_RESOURCES');
  });

  it('returns INVALID_PARAM when buyer tries to accept their own offer', async () => {
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    mockDbGet.mockResolvedValue({
      id: 'offer-1',
      sellerId: 'seller-1',
      resourceType: 'gold',
      quantity: 100,
      totalPrice: 500,
      status: 'open',
      expiresAt: futureDate,
    });

    const result = await callHandler(makeEvent({ offerId: 'offer-1', buyerId: 'seller-1' }));

    const parsed = JSON.parse(result as string);
    expect(parsed.success).toBe(false);
    expect(parsed.errorCode).toBe('INVALID_PARAM');
  });
});

describe('trade-processor handler — cancelTradeOffer', () => {
  it('cancels an open offer and refunds escrowed resources', async () => {
    mockDbGet.mockImplementation(async (model: string) => {
      if (model === 'TradeOffer') return {
        id: 'offer-1',
        sellerId: 'seller-1',
        resourceType: 'gold',
        quantity: 500,
        status: 'open',
      };
      if (model === 'Kingdom') return mockKingdom('seller-1', { resources: { gold: 0, population: 1000, mana: 0, land: 1000 } });
      return null;
    });

    const result = await callHandler(makeEvent({ offerId: 'offer-1', sellerId: 'seller-1' }));

    const parsed = JSON.parse(result as string);
    expect(parsed.success).toBe(true);
    expect(parsed.refunded).toBe(true);
  });

  it('returns VALIDATION_FAILED when a different seller tries to cancel', async () => {
    mockDbGet.mockResolvedValue({ id: 'offer-1', sellerId: 'actual-seller', status: 'open' });

    const result = await callHandler(makeEvent({ offerId: 'offer-1', sellerId: 'impersonator' }));

    const parsed = JSON.parse(result as string);
    expect(parsed.success).toBe(false);
    expect(parsed.errorCode).toBe('VALIDATION_FAILED');
  });
});
