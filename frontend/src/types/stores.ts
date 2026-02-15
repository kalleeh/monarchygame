// Store interface definitions - Context7 minimal approach
import type { Resource, TradeOffer, MarketData, TrendData, PriceHistoryEntry, EconomicIndicators, TrainingQueueItem } from './index';

export interface TradeStore {
  resources: Resource[];
  marketData: MarketData[];
  activeOffers: TradeOffer[];
  myOffers: TradeOffer[];
  selectedResource: Resource | null;
  marketTrends: Record<string, TrendData[]>;
  priceHistory: Record<string, PriceHistoryEntry[]>;
  economicIndicators: EconomicIndicators;
  lastOfferTime: number | null;
  loading: boolean;
  error: string | null;
  loadMarketData: () => Promise<void>;
  createOffer: (offer: Partial<TradeOffer>) => Promise<void>;
  cancelOffer: (offerId: string) => Promise<void>;
  acceptOffer: (offerId: string) => Promise<void>;
  selectResource: (resource: Resource | string) => void;
  simulateMarket: () => void;
  getResourceById: (id: string) => Resource | undefined;
  initializeTradeData: () => Promise<void>;
  clearError: () => void;
}

export interface TrainingStore {
  trainingQueue: TrainingQueueItem[];
  availableUnits: string[];
  loading: boolean;
  error: string | null;
  trainUnit: (kingdomId: string, unitType: string, quantity: number) => Promise<void>;
  cancelTraining: (itemId: string) => Promise<void>;
  getTrainingQueue: () => Promise<void>;
}
