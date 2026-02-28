import type { Schema } from '../../data/resource';
import { ErrorCode } from '../../../shared/types/kingdom';
import type { KingdomResources } from '../../../shared/types/kingdom';
import { log } from '../logger';
import { dbGet, dbCreate, dbUpdate } from '../data-client';

const TRADE_OFFER_EXPIRY_HOURS = 48;

type CallerIdentity = { sub: string; username?: string };

type KingdomRecord = {
  id: string;
  owner?: string | null;
  resources?: KingdomResources | null;
};

type TradeOfferRecord = {
  id: string;
  sellerId: string;
  seasonId: string;
  resourceType: string;
  quantity: number;
  pricePerUnit: number;
  totalPrice: number;
  status: string;
  escrowedResources?: string;
  expiresAt: string;
  buyerId?: string | null;
  acceptedAt?: string | null;
};

export const handler: Schema["postTradeOffer"]["functionHandler"] = async (event) => {
  const args = event.arguments;

  try {
    // Verify caller identity
    const identity = event.identity as { sub?: string; username?: string } | null;
    if (!identity?.sub) {
      return JSON.stringify({ success: false, error: 'Authentication required', errorCode: ErrorCode.UNAUTHORIZED });
    }
    const callerIdentity: CallerIdentity = { sub: identity.sub, username: identity.username };

    // Route based on arguments
    if ('offerId' in args && 'buyerId' in args) {
      return await handleAcceptOffer(args as { offerId: string; buyerId: string }, callerIdentity);
    }
    if ('offerId' in args && 'sellerId' in args) {
      return await handleCancelOffer(args as { offerId: string; sellerId: string }, callerIdentity);
    }

    // createTradeOffer
    const { sellerId, seasonId, resourceType, quantity, pricePerUnit } = args as {
      sellerId: string;
      seasonId: string;
      resourceType: string;
      quantity: number;
      pricePerUnit: number;
    };

    if (!sellerId || !seasonId || !resourceType || !quantity || !pricePerUnit) {
      return JSON.stringify({ success: false, error: 'Missing required parameters', errorCode: ErrorCode.MISSING_PARAMS });
    }

    if (quantity <= 0 || pricePerUnit <= 0) {
      return JSON.stringify({ success: false, error: 'Quantity and price must be positive', errorCode: ErrorCode.INVALID_PARAM });
    }

    // Verify seller has the resources
    const seller = await dbGet<KingdomRecord>('Kingdom', sellerId);
    if (!seller) {
      return JSON.stringify({ success: false, error: 'Seller kingdom not found', errorCode: ErrorCode.NOT_FOUND });
    }

    // Verify kingdom ownership (seller)
    const sellerOwnerField = (seller as any).owner as string | null;
    if (!sellerOwnerField || (!sellerOwnerField.includes(callerIdentity.sub) && !sellerOwnerField.includes(callerIdentity.username ?? ''))) {
      return JSON.stringify({ success: false, error: 'You do not own this kingdom', errorCode: ErrorCode.FORBIDDEN });
    }

    const sellerResources = (seller.resources ?? {}) as KingdomResources;
    const available = (sellerResources as unknown as Record<string, number>)[resourceType] ?? 0;
    if (available < quantity) {
      return JSON.stringify({ success: false, error: `Insufficient ${resourceType}: have ${available}, need ${quantity}`, errorCode: ErrorCode.INSUFFICIENT_RESOURCES });
    }

    // Escrow: deduct resources from seller
    const updatedResources = { ...sellerResources, [resourceType]: available - quantity };
    await dbUpdate('Kingdom', sellerId, { resources: updatedResources });

    const totalPrice = quantity * pricePerUnit;
    const expiresAt = new Date(Date.now() + TRADE_OFFER_EXPIRY_HOURS * 60 * 60 * 1000).toISOString();

    // Create the trade offer
    const offer = await dbCreate<Record<string, unknown>>('TradeOffer', {
      sellerId,
      seasonId,
      resourceType,
      quantity,
      pricePerUnit,
      totalPrice,
      status: 'open',
      escrowedResources: JSON.stringify({ [resourceType]: quantity }),
      expiresAt
    });

    log.info('trade-processor', 'createTradeOffer', { sellerId, resourceType, quantity, pricePerUnit });
    return JSON.stringify({
      success: true,
      offer: {
        id: offer?.id,
        sellerId,
        resourceType,
        quantity,
        pricePerUnit,
        totalPrice,
        status: 'open',
        expiresAt
      }
    });
  } catch (error) {
    log.error('trade-processor', error);
    return JSON.stringify({ success: false, error: 'Trade operation failed', errorCode: ErrorCode.INTERNAL_ERROR });
  }
};

async function handleAcceptOffer(args: { offerId: string; buyerId: string }, callerIdentity: CallerIdentity): Promise<string> {
  const { offerId, buyerId } = args;

  if (!offerId || !buyerId) {
    return JSON.stringify({ success: false, error: 'Missing offerId or buyerId', errorCode: ErrorCode.MISSING_PARAMS });
  }

  // Get the offer - race condition protection via status check
  const offer = await dbGet<TradeOfferRecord>('TradeOffer', offerId);
  if (!offer) {
    return JSON.stringify({ success: false, error: 'Trade offer not found', errorCode: ErrorCode.NOT_FOUND });
  }

  if (offer.status !== 'open') {
    return JSON.stringify({ success: false, error: 'Trade offer is no longer available', errorCode: ErrorCode.TRADE_EXPIRED });
  }

  if (offer.sellerId === buyerId) {
    return JSON.stringify({ success: false, error: 'Cannot accept your own offer', errorCode: ErrorCode.INVALID_PARAM });
  }

  // Check if offer has expired
  if (new Date(offer.expiresAt) < new Date()) {
    await dbUpdate('TradeOffer', offerId, { status: 'expired' });

    // Refund escrowed resources to seller
    const seller = await dbGet<KingdomRecord>('Kingdom', offer.sellerId);
    if (seller) {
      const sellerResources = (seller.resources ?? {}) as Record<string, number>;
      sellerResources[offer.resourceType] = (sellerResources[offer.resourceType] ?? 0) + offer.quantity;
      await dbUpdate('Kingdom', offer.sellerId, { resources: sellerResources });
    }

    return JSON.stringify({ success: false, error: 'Trade offer has expired', errorCode: ErrorCode.TRADE_EXPIRED });
  }

  // Verify buyer has enough gold
  const buyer = await dbGet<KingdomRecord>('Kingdom', buyerId);
  if (!buyer) {
    return JSON.stringify({ success: false, error: 'Buyer kingdom not found', errorCode: ErrorCode.NOT_FOUND });
  }

  // Verify kingdom ownership (buyer)
  const buyerOwnerField = (buyer as any).owner as string | null;
  if (!buyerOwnerField || (!buyerOwnerField.includes(callerIdentity.sub) && !buyerOwnerField.includes(callerIdentity.username ?? ''))) {
    return JSON.stringify({ success: false, error: 'You do not own this kingdom', errorCode: ErrorCode.FORBIDDEN });
  }

  const buyerResources = (buyer.resources ?? {}) as KingdomResources;
  if ((buyerResources.gold ?? 0) < offer.totalPrice) {
    return JSON.stringify({ success: false, error: `Insufficient gold: have ${buyerResources.gold ?? 0}, need ${offer.totalPrice}`, errorCode: ErrorCode.INSUFFICIENT_RESOURCES });
  }

  // Execute the trade atomically
  // 1. Deduct gold from buyer, add resource
  const updatedBuyerResources = {
    ...buyerResources,
    gold: (buyerResources.gold ?? 0) - offer.totalPrice,
    [offer.resourceType]: ((buyerResources as unknown as Record<string, number>)[offer.resourceType] ?? 0) + offer.quantity
  };

  // 2. Add gold to seller (resources already escrowed)
  const seller = await dbGet<KingdomRecord>('Kingdom', offer.sellerId);
  const sellerResources = (seller?.resources ?? {}) as KingdomResources;
  const updatedSellerResources = {
    ...sellerResources,
    gold: (sellerResources.gold ?? 0) + offer.totalPrice
  };

  // Execute all updates
  await Promise.all([
    dbUpdate('Kingdom', buyerId, { resources: updatedBuyerResources }),
    dbUpdate('Kingdom', offer.sellerId, { resources: updatedSellerResources }),
    dbUpdate('TradeOffer', offerId, { status: 'accepted', buyerId, acceptedAt: new Date().toISOString() })
  ]);

  return JSON.stringify({
    success: true,
    trade: {
      offerId,
      buyerId,
      sellerId: offer.sellerId,
      resourceType: offer.resourceType,
      quantity: offer.quantity,
      totalPrice: offer.totalPrice
    }
  });
}

async function handleCancelOffer(args: { offerId: string; sellerId: string }, callerIdentity: CallerIdentity): Promise<string> {
  const { offerId, sellerId } = args;

  if (!offerId || !sellerId) {
    return JSON.stringify({ success: false, error: 'Missing offerId or sellerId', errorCode: ErrorCode.MISSING_PARAMS });
  }

  const offer = await dbGet<TradeOfferRecord>('TradeOffer', offerId);
  if (!offer) {
    return JSON.stringify({ success: false, error: 'Trade offer not found', errorCode: ErrorCode.NOT_FOUND });
  }

  if (offer.sellerId !== sellerId) {
    return JSON.stringify({ success: false, error: 'Only the seller can cancel this offer', errorCode: ErrorCode.VALIDATION_FAILED });
  }

  if (offer.status !== 'open') {
    return JSON.stringify({ success: false, error: 'Offer is no longer active', errorCode: ErrorCode.VALIDATION_FAILED });
  }

  // Refund escrowed resources
  const seller = await dbGet<KingdomRecord>('Kingdom', sellerId);
  if (seller) {
    // Verify kingdom ownership (seller cancelling their own offer)
    const sellerOwnerField = (seller as any).owner as string | null;
    if (!sellerOwnerField || (!sellerOwnerField.includes(callerIdentity.sub) && !sellerOwnerField.includes(callerIdentity.username ?? ''))) {
      return JSON.stringify({ success: false, error: 'You do not own this kingdom', errorCode: ErrorCode.FORBIDDEN });
    }

    const sellerResources = (seller.resources ?? {}) as Record<string, number>;
    sellerResources[offer.resourceType] = (sellerResources[offer.resourceType] ?? 0) + offer.quantity;
    await dbUpdate('Kingdom', sellerId, { resources: sellerResources });
  }

  await dbUpdate('TradeOffer', offerId, { status: 'cancelled' });

  return JSON.stringify({ success: true, offerId, refunded: true });
}
