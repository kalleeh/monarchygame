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
    TradeOffer: {
      get: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      list: vi.fn(),
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
      resources: { gold: 50000, population: 5000, mana: 500, land: 1000 },
      buildings: {},
      totalUnits: {},
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
  mockClient.models.TradeOffer.create.mockResolvedValue({ data: { id: 'offer-1' }, errors: null });
  mockClient.models.TradeOffer.update.mockResolvedValue({ data: {}, errors: null });
});

describe('trade-processor handler — createTradeOffer', () => {
  describe('happy path', () => {
    it('escrews resources, creates trade offer, and returns offer details', async () => {
      mockClient.models.Kingdom.get.mockResolvedValue(
        mockKingdom('seller-1', { resources: { gold: 50000, population: 5000, mana: 500, land: 1000 } })
      );

      const result = await handler(
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
      const updateCall = mockClient.models.Kingdom.update.mock.calls[0][0];
      expect(updateCall.resources.gold).toBe(49000);
      expect(mockClient.models.TradeOffer.create).toHaveBeenCalledOnce();
    });
  });

  describe('validation failures', () => {
    it('returns MISSING_PARAMS when sellerId is absent', async () => {
      const result = await handler(
        makeEvent({ seasonId: 'season-1', resourceType: 'gold', quantity: 100, pricePerUnit: 5 })
      );

      const parsed = JSON.parse(result as string);
      expect(parsed.success).toBe(false);
      expect(parsed.errorCode).toBe('MISSING_PARAMS');
    });

    it('returns error when quantity is 0 or negative', async () => {
      const result = await handler(
        makeEvent({ sellerId: 'seller-1', seasonId: 's', resourceType: 'gold', quantity: 0, pricePerUnit: 5 })
      );

      const parsed = JSON.parse(result as string);
      expect(parsed.success).toBe(false);
    });

    it('returns INVALID_PARAM when pricePerUnit is negative', async () => {
      const result = await handler(
        makeEvent({ sellerId: 'seller-1', seasonId: 's', resourceType: 'gold', quantity: 100, pricePerUnit: -1 })
      );

      const parsed = JSON.parse(result as string);
      expect(parsed.success).toBe(false);
      expect(parsed.errorCode).toBe('INVALID_PARAM');
    });
  });

  describe('NOT_FOUND', () => {
    it('returns NOT_FOUND when seller kingdom does not exist', async () => {
      mockClient.models.Kingdom.get.mockResolvedValue({ data: null, errors: null });

      const result = await handler(
        makeEvent({ sellerId: 'ghost-seller', seasonId: 's', resourceType: 'gold', quantity: 100, pricePerUnit: 5 })
      );

      const parsed = JSON.parse(result as string);
      expect(parsed.success).toBe(false);
      expect(parsed.errorCode).toBe('NOT_FOUND');
    });
  });

  describe('INSUFFICIENT_RESOURCES', () => {
    it('returns INSUFFICIENT_RESOURCES when seller lacks the resource', async () => {
      mockClient.models.Kingdom.get.mockResolvedValue(
        mockKingdom('seller-1', { resources: { gold: 50, population: 5000, mana: 500, land: 1000 } })
      );

      const result = await handler(
        makeEvent({ sellerId: 'seller-1', seasonId: 's', resourceType: 'gold', quantity: 1000, pricePerUnit: 2 })
      );

      const parsed = JSON.parse(result as string);
      expect(parsed.success).toBe(false);
      expect(parsed.errorCode).toBe('INSUFFICIENT_RESOURCES');
      expect(mockClient.models.Kingdom.update).not.toHaveBeenCalled();
    });
  });
});

describe('trade-processor handler — acceptTradeOffer', () => {
  it('transfers resources and gold between buyer and seller', async () => {
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    mockClient.models.TradeOffer.get.mockResolvedValue({
      data: {
        id: 'offer-1',
        sellerId: 'seller-1',
        resourceType: 'mana',
        quantity: 100,
        pricePerUnit: 5,
        totalPrice: 500,
        status: 'open',
        expiresAt: futureDate,
      },
      errors: null,
    });

    // Kingdom.get called for: buyer and seller
    mockClient.models.Kingdom.get
      .mockResolvedValueOnce(mockKingdom('buyer-1', { resources: { gold: 10000, population: 1000, mana: 50, land: 1000 } }))
      .mockResolvedValueOnce(mockKingdom('seller-1', { resources: { gold: 1000, population: 1000, mana: 0, land: 1000 } }));

    const result = await handler(makeEvent({ offerId: 'offer-1', buyerId: 'buyer-1' }));

    const parsed = JSON.parse(result as string);
    expect(parsed.success).toBe(true);
    expect(parsed.trade.buyerId).toBe('buyer-1');
    expect(parsed.trade.sellerId).toBe('seller-1');
    expect(parsed.trade.quantity).toBe(100);
    expect(parsed.trade.totalPrice).toBe(500);
  });

  it('returns INSUFFICIENT_RESOURCES when buyer cannot afford the offer', async () => {
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    mockClient.models.TradeOffer.get.mockResolvedValue({
      data: {
        id: 'offer-1',
        sellerId: 'seller-1',
        resourceType: 'mana',
        quantity: 100,
        pricePerUnit: 5,
        totalPrice: 500,
        status: 'open',
        expiresAt: futureDate,
      },
      errors: null,
    });

    // Buyer has only 10 gold, needs 500
    mockClient.models.Kingdom.get.mockResolvedValue(
      mockKingdom('buyer-1', { resources: { gold: 10, population: 1000, mana: 0, land: 1000 } })
    );

    const result = await handler(makeEvent({ offerId: 'offer-1', buyerId: 'buyer-1' }));

    const parsed = JSON.parse(result as string);
    expect(parsed.success).toBe(false);
    expect(parsed.errorCode).toBe('INSUFFICIENT_RESOURCES');
  });

  it('returns INVALID_PARAM when buyer tries to accept their own offer', async () => {
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    mockClient.models.TradeOffer.get.mockResolvedValue({
      data: {
        id: 'offer-1',
        sellerId: 'seller-1',
        resourceType: 'gold',
        quantity: 100,
        totalPrice: 500,
        status: 'open',
        expiresAt: futureDate,
      },
      errors: null,
    });

    const result = await handler(makeEvent({ offerId: 'offer-1', buyerId: 'seller-1' }));

    const parsed = JSON.parse(result as string);
    expect(parsed.success).toBe(false);
    expect(parsed.errorCode).toBe('INVALID_PARAM');
  });
});

describe('trade-processor handler — cancelTradeOffer', () => {
  it('cancels an open offer and refunds escrowed resources', async () => {
    mockClient.models.TradeOffer.get.mockResolvedValue({
      data: {
        id: 'offer-1',
        sellerId: 'seller-1',
        resourceType: 'gold',
        quantity: 500,
        status: 'open',
      },
      errors: null,
    });

    mockClient.models.Kingdom.get.mockResolvedValue(
      mockKingdom('seller-1', { resources: { gold: 0, population: 1000, mana: 0, land: 1000 } })
    );

    const result = await handler(makeEvent({ offerId: 'offer-1', sellerId: 'seller-1' }));

    const parsed = JSON.parse(result as string);
    expect(parsed.success).toBe(true);
    expect(parsed.refunded).toBe(true);
  });

  it('returns VALIDATION_FAILED when a different seller tries to cancel', async () => {
    mockClient.models.TradeOffer.get.mockResolvedValue({
      data: { id: 'offer-1', sellerId: 'actual-seller', status: 'open' },
      errors: null,
    });

    const result = await handler(makeEvent({ offerId: 'offer-1', sellerId: 'impersonator' }));

    const parsed = JSON.parse(result as string);
    expect(parsed.success).toBe(false);
    expect(parsed.errorCode).toBe('VALIDATION_FAILED');
  });
});
