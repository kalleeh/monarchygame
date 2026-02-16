/**
 * Shared Type Definitions - Barrel Export
 * Re-exports all types from submodules and defines trade/market types
 */

// Re-exports from submodules
export type { KingdomResources, RaceType, AuthUser, AuthenticatorProps } from './amplify';
export type { Kingdom, Territory } from './kingdom';
export type { ApiResponse, SpellCastResponse, DiplomacyResponse, TrainingResponse, CreateOfferRequest } from './api';
export type { TrainedUnit, TrainingQueueItem, TrainableUnit } from './training';
// Note: TradeStore and TrainingStore are imported directly from './stores'
// to avoid circular dependencies (stores.ts imports from this file).

// ---------------------------------------------------------------------------
// Trade & Market Types
// ---------------------------------------------------------------------------

export interface Resource {
  id: string;
  name: string;
  type: 'basic' | 'luxury' | 'military' | 'magical';
  supply: number;
  demand: number;
  basePrice: number;
  currentPrice: number;
}

export interface TradeOffer {
  id: string;
  sellerId: string;
  sellerName: string;
  resourceId: string;
  quantity: number;
  pricePerUnit: number;
  totalPrice: number;
  status: 'open' | 'accepted' | 'cancelled' | 'expired';
  createdAt: number;
}

export interface MarketData {
  resourceId: string;
  price: number;
  volume: number;
  change: number;
  timestamp: number;
}

export interface TrendData {
  timestamp: number;
  price: number;
  volume: number;
  change: number;
}

export interface PriceHistoryEntry {
  timestamp: number;
  price: number;
  volume: number;
}

export interface EconomicIndicators {
  marketVolatility: number;
  tradeVolume: number;
  averagePrice: number;
  totalValue: number;
  // Extended properties used by the TradeSystem component indicator transitions
  name?: string;
  value?: number;
  trend?: 'up' | 'down' | 'stable';
  change?: number;
}
