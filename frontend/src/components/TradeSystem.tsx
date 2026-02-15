/**
 * Trade System Component with Market Analytics
 * IQC Compliant: Integrity (validation), Quality (animations), Consistency (patterns)
 */

import React, { useEffect, useState, useMemo } from 'react';
import { useSpring, useTransition, animated, config } from '@react-spring/web';
import type { Resource, TradeOffer, MarketData, TrendData, PriceHistoryEntry, EconomicIndicators } from '../types';
import type { TradeStore } from '../types/stores';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
// Mock types and store for TradeSystem
// Mock store with proper typing - Context7 pattern
const useTradeStore = (): TradeStore => ({
  resources: [] as Resource[],
  marketData: [] as MarketData[],
  activeOffers: [] as TradeOffer[],
  myOffers: [] as TradeOffer[],
  selectedResource: null as Resource | null,
  marketTrends: {} as Record<string, TrendData[]>,
  priceHistory: {} as Record<string, PriceHistoryEntry[]>,
  economicIndicators: { marketVolatility: 0, tradeVolume: 0, averagePrice: 0, totalValue: 0 } as EconomicIndicators,
  loading: false,
  error: null as string | null,
  loadMarketData: () => Promise.resolve(),
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  createOffer: (_offer: Partial<TradeOffer>) => Promise.resolve(),
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  cancelOffer: (_offerId: string) => Promise.resolve(),
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  acceptOffer: (_offerId: string) => Promise.resolve(),
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  selectResource: (_resource: Resource | string) => {},
  simulateMarket: () => {},
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getResourceById: (_id: string) => undefined as Resource | undefined,
  initializeTradeData: () => Promise.resolve(),
  clearError: () => {}
});

interface TradeSystemProps {
  kingdomId: string;
  onBack?: () => void;
}

const TradeSystem: React.FC<TradeSystemProps> = ({ onBack }) => {
  const {
    resources,
    activeOffers,
    economicIndicators,
    marketTrends,
    priceHistory,
    selectedResource,
    loading,
    error,
    selectResource,
    createOffer,
    acceptOffer,
    cancelOffer,
    simulateMarket,
    getResourceById,
    clearError,
    initializeTradeData
  } = useTradeStore();

  const [offerForm, setOfferForm] = useState({
    resourceId: '',
    quantity: 0,
    pricePerUnit: 0
  });
  
  const [showCreateOffer, setShowCreateOffer] = useState(false);

  // Initialize trade data on mount
  useEffect(() => {
    initializeTradeData();
    
    // Simulate market every 30 seconds
    const interval = setInterval(() => {
      simulateMarket();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [initializeTradeData, simulateMarket]);

  // Market overview animation
  const marketSpring = useSpring({
    opacity: loading ? 0.6 : 1,
    transform: loading ? 'scale(0.98)' : 'scale(1)',
    config: config.gentle
  });

  // Economic indicators animation
  const indicatorTransitions = useTransition(economicIndicators, {
    from: { opacity: 0, x: -50 },
    enter: { opacity: 1, x: 0 },
    leave: { opacity: 0, x: 50 },
    config: config.gentle
  });

  // Offers animation
  const offerTransitions = useTransition(activeOffers, {
    from: { opacity: 0, scale: 0.8, y: 20 },
    enter: { opacity: 1, scale: 1, y: 0 },
    leave: { opacity: 0, scale: 0.8, y: -20 },
    config: config.wobbly
  });

  // Chart data preparation
  const selectedResourceData = useMemo(() => {
    if (!selectedResource || !(priceHistory as Record<string, PriceHistoryEntry[]>)[selectedResource.id]) return [];
    
    return (priceHistory as Record<string, PriceHistoryEntry[]>)[selectedResource.id].slice(-30).map((data: PriceHistoryEntry) => ({
      time: new Date(data.timestamp).toLocaleDateString(),
      price: data.price,
      volume: data.volume
    }));
  }, [selectedResource, priceHistory]);

  const resourceDistribution = useMemo(() => {
    return resources.map(resource => ({
      name: resource.name,
      value: resource.supply,
      color: getResourceColor((resource as Resource & { type?: string }).type || 'default')
    }));
  }, [resources]);

  const handleCreateOffer = async () => {
    if (offerForm.resourceId && offerForm.quantity > 0 && offerForm.pricePerUnit > 0) {
      await createOffer(offerForm as Partial<TradeOffer>);
      setOfferForm({ resourceId: '', quantity: 0, pricePerUnit: 0 });
      setShowCreateOffer(false);
    }
  };

  const handleAcceptOffer = async (offerId: string) => {
    await acceptOffer(offerId);
  };

  return (
    <div className="trade-system">
      {/* Header with Back Navigation */}
      <div className="trade-header">
        {onBack && (
          <button className="back-btn" onClick={onBack}>
            ← Back to Kingdom
          </button>
        )}
        <h1>💰 Trade System</h1>
      </div>

      {/* Error Display */}
      {error && (
        <div className="error-banner">
          <span>⚠️ {error}</span>
          <button onClick={clearError} aria-label="Dismiss error">×</button>
        </div>
      )}

      {/* Market Overview */}
      <animated.div className="market-overview" style={marketSpring}>
        <h2>Market Overview</h2>
        
        {/* Economic Indicators */}
        <div className="economic-indicators">
          {indicatorTransitions((style, indicator) => (
            <animated.div key={indicator.name} style={style} className="indicator-card">
              <div className="indicator-header">
                <span className="indicator-name">{indicator.name}</span>
                <span className={`indicator-trend ${indicator.trend}`}>
                  {indicator.trend === 'up' ? '↗️' : indicator.trend === 'down' ? '↘️' : '➡️'}
                </span>
              </div>
              <div className="indicator-value">{(indicator.value || 0).toLocaleString()}</div>
              <div className={`indicator-change ${(indicator.change || 0) >= 0 ? 'positive' : 'negative'}`}>
                {(indicator.change || 0) >= 0 ? '+' : ''}{(indicator.change || 0).toFixed(1)}%
              </div>
            </animated.div>
          ))}
        </div>

        {/* Resource Market */}
        <div className="resource-market">
          <h3>Resource Prices</h3>
          <div className="resource-grid">
            {resources.map(resource => {
              const trendData = (marketTrends[resource.id] as unknown as TrendData[])?.[0];
              const trend = trendData ? (trendData.change > 0 ? 'bullish' : trendData.change < 0 ? 'bearish' : 'neutral') : 'neutral';
              
              return (
                <ResourceCard
                  key={resource.id}
                  resource={resource}
                  trend={trend}
                  isSelected={selectedResource?.id === resource.id}
                  onSelect={() => selectResource(resource.id)}
                />
              );
            })}
          </div>
        </div>
      </animated.div>

      {/* Price Chart */}
      {selectedResource && selectedResourceData.length > 0 && (
        <div className="price-chart-section">
          <h3>{resources.find(r => r.id === selectedResource.id)?.name} Price History</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={selectedResourceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
                <XAxis 
                  dataKey="time" 
                  stroke="var(--text-secondary)"
                  fontSize={12}
                />
                <YAxis 
                  stroke="var(--text-secondary)"
                  fontSize={12}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-primary)',
                    borderRadius: '0.375rem',
                    color: 'var(--text-primary)'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="price" 
                  stroke="var(--primary)" 
                  strokeWidth={2}
                  dot={{ fill: 'var(--primary)', strokeWidth: 2, r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Market Distribution */}
      <div className="market-distribution">
        <h3>Resource Distribution</h3>
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={resourceDistribution}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey="value"
                label={({ name, percent }: { name: string; percent?: number }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
              >
                {resourceDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-primary)',
                  borderRadius: '0.375rem',
                  color: 'var(--text-primary)'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Active Offers */}
      <div className="active-offers">
        <div className="section-header">
          <h3>Active Offers</h3>
          <button 
            className="create-offer-btn"
            onClick={() => setShowCreateOffer(true)}
          >
            Create Offer
          </button>
        </div>
        
        <div className="offers-grid">
          {offerTransitions((style, offer) => (
            <animated.div key={offer.id} style={style} className="offer-card">
              <div className="offer-header">
                <span className="resource-name">
                  {getResourceById(offer.resourceId)?.name}
                </span>
                <span className="offer-status">{offer.status}</span>
              </div>
              <div className="offer-details">
                <div className="offer-quantity">{offer.quantity} units</div>
                <div className="offer-price">{offer.pricePerUnit}💰 per unit</div>
                <div className="offer-total">Total: {offer.totalPrice}💰</div>
              </div>
              <div className="offer-actions">
                {offer.sellerId !== 'current-player' ? (
                  <button 
                    className="accept-btn"
                    onClick={() => handleAcceptOffer(offer.id)}
                    disabled={loading}
                  >
                    Accept
                  </button>
                ) : (
                  <button 
                    className="cancel-btn"
                    onClick={() => cancelOffer(offer.id)}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </animated.div>
          ))}
        </div>
      </div>

      {/* Create Offer Modal */}
      {showCreateOffer && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Create Trade Offer</h3>
            <div className="offer-form">
              <select
                value={offerForm.resourceId}
                onChange={(e) => setOfferForm(prev => ({ ...prev, resourceId: e.target.value }))}
                className="form-select"
              >
                <option value="">Select Resource</option>
                {resources.map(resource => (
                  <option key={resource.id} value={resource.id}>
                    {resource.name}
                  </option>
                ))}
              </select>
              
              <input
                type="number"
                placeholder="Quantity"
                value={offerForm.quantity || ''}
                onChange={(e) => setOfferForm(prev => ({ ...prev, quantity: parseInt(e.target.value) || 0 }))}
                className="form-input"
              />
              
              <input
                type="number"
                placeholder="Price per unit"
                value={offerForm.pricePerUnit || ''}
                onChange={(e) => setOfferForm(prev => ({ ...prev, pricePerUnit: parseFloat(e.target.value) || 0 }))}
                className="form-input"
              />
              
              <div className="modal-actions">
                <button 
                  className="create-btn"
                  onClick={handleCreateOffer}
                  disabled={!offerForm.resourceId || offerForm.quantity <= 0 || offerForm.pricePerUnit <= 0}
                >
                  Create Offer
                </button>
                <button 
                  className="cancel-btn"
                  onClick={() => setShowCreateOffer(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Resource Card Component
interface ResourceCardProps {
  resource: Resource;
  trend: 'bullish' | 'bearish' | 'neutral';
  isSelected: boolean;
  onSelect: () => void;
}

const ResourceCard: React.FC<ResourceCardProps> = ({ resource, trend, isSelected, onSelect }) => {
  const cardSpring = useSpring({
    borderColor: isSelected ? 'var(--primary)' : 'var(--border-primary)',
    backgroundColor: isSelected ? 'rgba(79, 172, 254, 0.1)' : 'var(--bg-card)',
    scale: isSelected ? 1.02 : 1,
    config: config.gentle
  });

  const resourceWithPrices = resource as Resource & { currentPrice?: number; basePrice?: number };
  const currentPrice = resourceWithPrices.currentPrice || 0;
  const basePrice = resourceWithPrices.basePrice || 1;
  const priceChange = ((currentPrice - basePrice) / basePrice) * 100;

  return (
    <animated.div
      style={cardSpring}
      className={`resource-card ${isSelected ? 'selected' : ''}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      aria-label={`Resource: ${resource.name}`}
    >
      <div className="resource-header">
        <span className="resource-name">{resource.name}</span>
        <span className={`trend-indicator ${trend}`}>
          {trend === 'bullish' ? '📈' : trend === 'bearish' ? '📉' : '➡️'}
        </span>
      </div>
      
      <div className="resource-price">
        <span className="current-price">{((resource as Resource & { currentPrice?: number }).currentPrice || 0).toFixed(2)}💰</span>
        <span className={`price-change ${priceChange >= 0 ? 'positive' : 'negative'}`}>
          {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(1)}%
        </span>
      </div>
      
      <div className="resource-supply-demand">
        <div className="supply">Supply: {resource.supply}</div>
        <div className="demand">Demand: {resource.demand}</div>
      </div>
    </animated.div>
  );
};

// Helper function
function getResourceColor(type: string): string {
  const colors = {
    basic: '#8884d8',
    luxury: '#82ca9d',
    military: '#ffc658',
    magical: '#ff7c7c'
  };
  return colors[type as keyof typeof colors] || '#8884d8';
}

export default TradeSystem;
