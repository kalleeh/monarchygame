/**
 * Domain service for trade processor calls.
 * Delegates to AmplifyFunctionService for transport.
 */

import { AmplifyFunctionService } from '../amplifyFunctionService';

export interface PostTradeOfferPayload {
  kingdomId: string;
  seasonId: string;
  resourceType: string;
  quantity: number;
  pricePerUnit: number;
}

export interface AcceptTradeOfferPayload {
  kingdomId: string;
  offerId: string;
}

export interface CancelTradeOfferPayload {
  kingdomId: string;
  offerId: string;
}

export interface TradeResult {
  success: boolean;
  offer?: { id: string; status: string };
  error?: string;
}

export async function postTradeOffer(payload: PostTradeOfferPayload): Promise<TradeResult> {
  return AmplifyFunctionService.callFunction('trade-processor', {
    ...payload,
    action: 'post',
  }) as Promise<TradeResult>;
}

export async function acceptTradeOffer(payload: AcceptTradeOfferPayload): Promise<TradeResult> {
  return AmplifyFunctionService.callFunction('trade-processor', {
    ...payload,
    action: 'accept',
  }) as Promise<TradeResult>;
}

export async function cancelTradeOffer(payload: CancelTradeOfferPayload): Promise<TradeResult> {
  return AmplifyFunctionService.callFunction('trade-processor', {
    ...payload,
    action: 'cancel',
  }) as Promise<TradeResult>;
}
