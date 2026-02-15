/**
 * Trade Store - Functional Market & Trade System
 * Simulates a resource market with price fluctuation, offers, and localStorage persistence.
 * Works in demo mode without Lambda calls.
 */
import { create } from 'zustand';
import type { TradeStore } from '../types/stores';
import type { Resource, TradeOffer, MarketData, TrendData, PriceHistoryEntry } from '../types';
import { useKingdomStore } from './kingdomStore';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY_OFFERS = 'trade-offers';
const STORAGE_KEY_HISTORY = 'trade-price-history';
const PLAYER_ID = 'current-player';

/** Base price configuration for the four core resources */
const BASE_RESOURCES: Omit<Resource, 'currentPrice' | 'supply' | 'demand'>[] = [
  { id: 'gold',       name: 'Gold',       type: 'basic',   basePrice: 1.0  },
  { id: 'mana',       name: 'Mana',       type: 'magical', basePrice: 2.5  },
  { id: 'population', name: 'Population', type: 'basic',   basePrice: 0.5  },
  { id: 'land',       name: 'Land',       type: 'luxury',  basePrice: 10.0 },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Persist offers to localStorage */
function saveOffers(offers: TradeOffer[]): void {
  localStorage.setItem(STORAGE_KEY_OFFERS, JSON.stringify(offers));
}

/** Load offers from localStorage */
function loadOffers(): TradeOffer[] {
  const raw = localStorage.getItem(STORAGE_KEY_OFFERS);
  return raw ? JSON.parse(raw) : [];
}

/** Persist price history to localStorage */
function savePriceHistory(history: Record<string, PriceHistoryEntry[]>): void {
  localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history));
}

/** Load price history from localStorage */
function loadPriceHistory(): Record<string, PriceHistoryEntry[]> {
  const raw = localStorage.getItem(STORAGE_KEY_HISTORY);
  return raw ? JSON.parse(raw) : {};
}

/** Generate a random variation factor between min and max (e.g. 0.85 - 1.15) */
function randomVariation(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** Build a full Resource with simulated supply/demand and a randomised current price */
function generateResource(base: Omit<Resource, 'currentPrice' | 'supply' | 'demand'>): Resource {
  const variation = randomVariation(0.85, 1.15);
  return {
    ...base,
    currentPrice: parseFloat((base.basePrice * variation).toFixed(2)),
    supply: Math.floor(1000 + Math.random() * 4000),
    demand: Math.floor(800 + Math.random() * 4200),
  };
}

/** Derive market trends from price history for a single resource */
function deriveTrend(history: PriceHistoryEntry[]): TrendData[] {
  if (history.length < 2) return [];
  const recent = history.slice(-10);
  return recent.map((entry, i) => {
    const prev = i > 0 ? recent[i - 1] : entry;
    const change = prev.price > 0 ? ((entry.price - prev.price) / prev.price) * 100 : 0;
    return {
      timestamp: entry.timestamp,
      price: entry.price,
      volume: entry.volume,
      change: parseFloat(change.toFixed(2)),
    };
  });
}

/** Calculate aggregate economic indicators from all resources */
function calculateIndicators(resources: Resource[]): {
  marketVolatility: number;
  tradeVolume: number;
  averagePrice: number;
  totalValue: number;
} {
  if (resources.length === 0) {
    return { marketVolatility: 0, tradeVolume: 0, averagePrice: 0, totalValue: 0 };
  }
  const totalSupply = resources.reduce((s, r) => s + r.supply, 0);
  const totalDemand = resources.reduce((s, r) => s + r.demand, 0);
  const avgPrice = resources.reduce((s, r) => s + r.currentPrice, 0) / resources.length;
  const volatility = resources.reduce((s, r) => {
    const diff = Math.abs(r.currentPrice - r.basePrice) / r.basePrice;
    return s + diff;
  }, 0) / resources.length;

  return {
    marketVolatility: parseFloat((volatility * 100).toFixed(1)),
    tradeVolume: totalSupply + totalDemand,
    averagePrice: parseFloat(avgPrice.toFixed(2)),
    totalValue: Math.floor(resources.reduce((s, r) => s + r.currentPrice * r.supply, 0)),
  };
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useTradeStore = create<TradeStore>((set, get) => ({
  resources: [],
  marketData: [],
  activeOffers: [],
  myOffers: [],
  selectedResource: null,
  marketTrends: {},
  priceHistory: {},
  economicIndicators: { marketVolatility: 0, tradeVolume: 0, averagePrice: 0, totalValue: 0 },
  loading: false,
  error: null,

  // -----------------------------------------------------------------------
  // loadMarketData — generate simulated market data for the 4 core resources
  // -----------------------------------------------------------------------
  loadMarketData: async () => {
    set({ loading: true, error: null });

    try {
      const resources = BASE_RESOURCES.map(generateResource);

      // Build initial market data snapshot
      const now = Date.now();
      const marketData: MarketData[] = resources.map(r => ({
        resourceId: r.id,
        price: r.currentPrice,
        volume: r.supply + r.demand,
        change: parseFloat((((r.currentPrice - r.basePrice) / r.basePrice) * 100).toFixed(2)),
        timestamp: now,
      }));

      // Seed price history (last 30 ticks) if nothing persisted
      let priceHistory = loadPriceHistory();
      const needsSeed = resources.some(r => !priceHistory[r.id] || priceHistory[r.id].length === 0);
      if (needsSeed) {
        priceHistory = {};
        for (const r of resources) {
          const entries: PriceHistoryEntry[] = [];
          let price = r.basePrice;
          for (let i = 30; i >= 0; i--) {
            price = parseFloat((price * randomVariation(0.97, 1.03)).toFixed(2));
            entries.push({
              timestamp: now - i * 60_000,
              price,
              volume: Math.floor(500 + Math.random() * 2000),
            });
          }
          priceHistory[r.id] = entries;
        }
        savePriceHistory(priceHistory);
      }

      // Derive trends
      const marketTrends: Record<string, TrendData[]> = {};
      for (const r of resources) {
        marketTrends[r.id] = deriveTrend(priceHistory[r.id] || []);
      }

      set({
        resources,
        marketData,
        priceHistory,
        marketTrends,
        economicIndicators: calculateIndicators(resources),
        loading: false,
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load market data', loading: false });
    }
  },

  // -----------------------------------------------------------------------
  // createOffer — create a trade offer and deduct the offered resource
  // -----------------------------------------------------------------------
  createOffer: async (offer: Partial<TradeOffer>) => {
    const { resources } = get();

    if (!offer.resourceId || !offer.quantity || offer.quantity <= 0 || !offer.pricePerUnit || offer.pricePerUnit <= 0) {
      set({ error: 'Invalid offer: resourceId, quantity, and pricePerUnit are required' });
      return;
    }

    const resource = resources.find(r => r.id === offer.resourceId);
    if (!resource) {
      set({ error: `Unknown resource: ${offer.resourceId}` });
      return;
    }

    // Deduct the offered resource from the player's kingdom
    const kingdom = useKingdomStore.getState();
    const currentAmount = (kingdom.resources as Record<string, number>)[offer.resourceId] ?? 0;
    if (currentAmount < offer.quantity) {
      set({ error: `Insufficient ${resource.name}: have ${currentAmount}, need ${offer.quantity}` });
      return;
    }

    // Deduct resource
    kingdom.updateResources({ [offer.resourceId]: currentAmount - offer.quantity });

    const newOffer: TradeOffer = {
      id: `offer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      sellerId: PLAYER_ID,
      sellerName: 'Your Kingdom',
      resourceId: offer.resourceId,
      quantity: offer.quantity,
      pricePerUnit: offer.pricePerUnit,
      totalPrice: parseFloat((offer.quantity * offer.pricePerUnit).toFixed(2)),
      status: 'open',
      createdAt: Date.now(),
    };

    const allOffers = [...get().activeOffers, newOffer];
    saveOffers(allOffers);

    set({
      activeOffers: allOffers,
      myOffers: allOffers.filter(o => o.sellerId === PLAYER_ID && o.status === 'open'),
      error: null,
    });
  },

  // -----------------------------------------------------------------------
  // acceptOffer — accept an offer and transfer resources between kingdoms
  // -----------------------------------------------------------------------
  acceptOffer: async (offerId: string) => {
    const { activeOffers } = get();
    const offer = activeOffers.find(o => o.id === offerId);

    if (!offer) {
      set({ error: 'Offer not found' });
      return;
    }
    if (offer.status !== 'open') {
      set({ error: 'Offer is no longer available' });
      return;
    }
    if (offer.sellerId === PLAYER_ID) {
      set({ error: 'Cannot accept your own offer' });
      return;
    }

    // Buyer (current player) pays gold for the resource
    const kingdom = useKingdomStore.getState();
    const currentGold = kingdom.resources.gold || 0;
    if (currentGold < offer.totalPrice) {
      set({ error: `Insufficient gold: have ${currentGold}, need ${offer.totalPrice}` });
      return;
    }

    // Deduct gold and add the resource to the buyer
    const currentResourceAmount = (kingdom.resources as Record<string, number>)[offer.resourceId] ?? 0;
    kingdom.updateResources({
      gold: currentGold - offer.totalPrice,
      [offer.resourceId]: currentResourceAmount + offer.quantity,
    });

    // Mark offer as accepted
    const updatedOffers = activeOffers.map(o =>
      o.id === offerId ? { ...o, status: 'accepted' as const } : o
    );
    saveOffers(updatedOffers);

    set({
      activeOffers: updatedOffers.filter(o => o.status === 'open'),
      myOffers: updatedOffers.filter(o => o.sellerId === PLAYER_ID && o.status === 'open'),
      error: null,
    });
  },

  // -----------------------------------------------------------------------
  // cancelOffer — cancel own offer and refund the escrowed resource
  // -----------------------------------------------------------------------
  cancelOffer: async (offerId: string) => {
    const { activeOffers } = get();
    const offer = activeOffers.find(o => o.id === offerId);

    if (!offer) {
      set({ error: 'Offer not found' });
      return;
    }
    if (offer.sellerId !== PLAYER_ID) {
      set({ error: 'Can only cancel your own offers' });
      return;
    }
    if (offer.status !== 'open') {
      set({ error: 'Offer is no longer active' });
      return;
    }

    // Refund the resource back to the player
    const kingdom = useKingdomStore.getState();
    const currentAmount = (kingdom.resources as Record<string, number>)[offer.resourceId] ?? 0;
    kingdom.updateResources({ [offer.resourceId]: currentAmount + offer.quantity });

    // Mark offer as cancelled
    const updatedOffers = activeOffers.map(o =>
      o.id === offerId ? { ...o, status: 'cancelled' as const } : o
    );
    saveOffers(updatedOffers);

    set({
      activeOffers: updatedOffers.filter(o => o.status === 'open'),
      myOffers: updatedOffers.filter(o => o.sellerId === PLAYER_ID && o.status === 'open'),
      error: null,
    });
  },

  // -----------------------------------------------------------------------
  // selectResource
  // -----------------------------------------------------------------------
  selectResource: (resource: Resource | string) => {
    const selectedResource = typeof resource === 'string'
      ? get().resources.find(r => r.id === resource) || null
      : resource;
    set({ selectedResource });
  },

  // -----------------------------------------------------------------------
  // simulateMarket — adjust prices randomly (+-5%) to simulate fluctuation
  // Called on turn generation or periodically.
  // -----------------------------------------------------------------------
  simulateMarket: () => {
    const { resources, priceHistory } = get();
    if (resources.length === 0) return;

    const now = Date.now();
    const updatedResources = resources.map(r => {
      // Random price movement: +-5%
      const fluctuation = randomVariation(0.95, 1.05);
      const newPrice = parseFloat((r.currentPrice * fluctuation).toFixed(2));

      // Supply/demand also shift slightly
      const supplyShift = Math.floor(r.supply * randomVariation(-0.03, 0.03));
      const demandShift = Math.floor(r.demand * randomVariation(-0.03, 0.03));

      return {
        ...r,
        currentPrice: Math.max(0.01, newPrice),
        supply: Math.max(100, r.supply + supplyShift),
        demand: Math.max(100, r.demand + demandShift),
      };
    });

    // Append new entries to price history
    const updatedHistory = { ...priceHistory };
    for (const r of updatedResources) {
      const entries = [...(updatedHistory[r.id] || [])];
      entries.push({
        timestamp: now,
        price: r.currentPrice,
        volume: r.supply + r.demand,
      });
      // Keep last 100 entries
      updatedHistory[r.id] = entries.slice(-100);
    }
    savePriceHistory(updatedHistory);

    // Rebuild market data
    const marketData = updatedResources.map(r => ({
      resourceId: r.id,
      price: r.currentPrice,
      volume: r.supply + r.demand,
      change: parseFloat((((r.currentPrice - r.basePrice) / r.basePrice) * 100).toFixed(2)),
      timestamp: now,
    }));

    // Rebuild trends
    const marketTrends: Record<string, TrendData[]> = {};
    for (const r of updatedResources) {
      marketTrends[r.id] = deriveTrend(updatedHistory[r.id] || []);
    }

    set({
      resources: updatedResources,
      marketData,
      priceHistory: updatedHistory,
      marketTrends,
      economicIndicators: calculateIndicators(updatedResources),
    });
  },

  // -----------------------------------------------------------------------
  // getResourceById
  // -----------------------------------------------------------------------
  getResourceById: (id: string) => {
    return get().resources.find(r => r.id === id);
  },

  // -----------------------------------------------------------------------
  // initializeTradeData — one-time setup that loads market + persisted offers
  // -----------------------------------------------------------------------
  initializeTradeData: async () => {
    // Load market first
    await get().loadMarketData();

    // Restore persisted offers
    const allOffers = loadOffers().filter(o => o.status === 'open');
    set({
      activeOffers: allOffers,
      myOffers: allOffers.filter(o => o.sellerId === PLAYER_ID),
    });

    // Seed a few AI offers so the market isn't empty
    const { resources, activeOffers } = get();
    const aiOfferCount = activeOffers.filter(o => o.sellerId !== PLAYER_ID).length;
    if (aiOfferCount === 0 && resources.length > 0) {
      const aiOffers: TradeOffer[] = [];
      const aiNames = ['Northern Empire', 'Shadow Realm', 'Golden Dynasty'];

      for (let i = 0; i < 3; i++) {
        const resource = resources[Math.floor(Math.random() * resources.length)];
        const quantity = Math.floor(50 + Math.random() * 200);
        const pricePerUnit = parseFloat((resource.currentPrice * randomVariation(0.9, 1.1)).toFixed(2));

        aiOffers.push({
          id: `ai-offer-${Date.now()}-${i}`,
          sellerId: `ai-kingdom-${i}`,
          sellerName: aiNames[i],
          resourceId: resource.id,
          quantity,
          pricePerUnit,
          totalPrice: parseFloat((quantity * pricePerUnit).toFixed(2)),
          status: 'open',
          createdAt: Date.now() - Math.floor(Math.random() * 300_000),
        });
      }

      const combined = [...activeOffers, ...aiOffers];
      saveOffers(combined);
      set({
        activeOffers: combined,
        myOffers: combined.filter(o => o.sellerId === PLAYER_ID && o.status === 'open'),
      });
    }
  },

  // -----------------------------------------------------------------------
  // clearError
  // -----------------------------------------------------------------------
  clearError: () => {
    set({ error: null });
  },
}));
