import type { Schema } from '../../data/resource';
import { ErrorCode } from '../../../shared/types/kingdom';
import type { KingdomResources } from '../../../shared/types/kingdom';
import { log } from '../logger';
import { dbGet, dbCreate, dbUpdate, dbConditionalUpdate, dbQuery, parseJsonField } from '../data-client';
import { verifyOwnership } from '../verify-ownership';
import { checkRateLimit } from '../rate-limiter';

const TRADE_OFFER_EXPIRY_HOURS = 48;

type CallerIdentity = { sub: string; username?: string };

type KingdomRecord = {
  id: string;
  owner?: string | null;
  resources?: KingdomResources | null;
  race?: string | null;
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

    // Rate limit check
    const rateLimited = checkRateLimit(identity.sub, 'trade');
    if (rateLimited) return JSON.stringify(rateLimited);

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
    const sellerDenied = verifyOwnership(callerIdentity, (seller as any).owner as string | null);
    if (sellerDenied) return JSON.stringify(sellerDenied);

    const sellerResources = parseJsonField<KingdomResources>(seller.resources, {} as KingdomResources);
    const available = (sellerResources as unknown as Record<string, number>)[resourceType] ?? 0;
    if (available < quantity) {
      return JSON.stringify({ success: false, error: `Insufficient ${resourceType}: have ${available}, need ${quantity}`, errorCode: ErrorCode.INSUFFICIENT_RESOURCES });
    }

    // Enforce active trade offer limit (Human race: 2, others: 1)
    const allOffers = await dbQuery<{ sellerId: string; status: string }>('TradeOffer', 'tradeOffersBySellerId', { field: 'sellerId', value: sellerId });
    const activeOffers = allOffers.filter(o => o.status === 'open');
    const isHuman = (seller.race as string | undefined)?.toLowerCase() === 'human';
    const maxOffers = isHuman ? 2 : 1;
    if (activeOffers.length >= maxOffers) {
      return JSON.stringify({
        success: false,
        error: `You already have ${activeOffers.length} active trade offer${activeOffers.length > 1 ? 's' : ''}. ${isHuman ? 'Human kingdoms can have up to 2.' : 'Cancel an existing offer to create a new one.'}`,
        errorCode: 'VALIDATION_FAILED'
      });
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
    return JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Trade operation failed', errorCode: ErrorCode.INTERNAL_ERROR });
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
      const sellerResources = parseJsonField<Record<string, number>>(seller.resources, {});
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
  const buyerDenied = verifyOwnership(callerIdentity, (buyer as any).owner as string | null);
  if (buyerDenied) return JSON.stringify(buyerDenied);

  const buyerResources = parseJsonField<KingdomResources>(buyer.resources, {} as KingdomResources);
  if ((buyerResources.gold ?? 0) < offer.totalPrice) {
    return JSON.stringify({ success: false, error: `Insufficient gold: have ${buyerResources.gold ?? 0}, need ${offer.totalPrice}`, errorCode: ErrorCode.INSUFFICIENT_RESOURCES });
  }

  // Atomically claim the offer using a conditional expression.
  // Only succeeds if status is still 'open' — prevents two concurrent buyers.
  try {
    await dbConditionalUpdate(
      'TradeOffer',
      offerId,
      { status: 'accepted', buyerId, acceptedAt: new Date().toISOString() },
      '#offerStatus = :open',
      { ':open': 'open' },
      { '#offerStatus': 'status' }
    );
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'ConditionalCheckFailedException') {
      return JSON.stringify({ success: false, error: 'Trade offer was already accepted by another buyer', errorCode: ErrorCode.TRADE_EXPIRED });
    }
    throw err;
  }

  // 1. Deduct gold from buyer, add resource
  const updatedBuyerResources = {
    ...buyerResources,
    gold: (buyerResources.gold ?? 0) - offer.totalPrice,
    [offer.resourceType]: ((buyerResources as unknown as Record<string, number>)[offer.resourceType] ?? 0) + offer.quantity
  };

  // 2. Add gold to seller (resources already escrowed)
  const seller = await dbGet<KingdomRecord>('Kingdom', offer.sellerId);
  const sellerResources = parseJsonField<KingdomResources>(seller?.resources, {} as KingdomResources);
  const updatedSellerResources = {
    ...sellerResources,
    gold: (sellerResources.gold ?? 0) + offer.totalPrice
  };

  // Transfer resources now that the offer is claimed
  await Promise.all([
    dbUpdate('Kingdom', buyerId, { resources: updatedBuyerResources }),
    dbUpdate('Kingdom', offer.sellerId, { resources: updatedSellerResources }),
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
    const cancelDenied = verifyOwnership(callerIdentity, (seller as any).owner as string | null);
    if (cancelDenied) return JSON.stringify(cancelDenied);

    const sellerResources = parseJsonField<Record<string, number>>(seller.resources, {});
    sellerResources[offer.resourceType] = (sellerResources[offer.resourceType] ?? 0) + offer.quantity;
    await dbUpdate('Kingdom', sellerId, { resources: sellerResources });
  }

  await dbUpdate('TradeOffer', offerId, { status: 'cancelled' });

  return JSON.stringify({ success: true, offerId, refunded: true });
}
