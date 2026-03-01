import React, { useState, useCallback } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ErrorBoundary } from './ErrorBoundary';
import { useKingdomStore } from '../stores/kingdomStore';
import type { Schema } from '../../../amplify/data/resource';
import './TradeEconomy.css';

interface TradeEconomyProps {
  kingdom: Schema['Kingdom']['type'];
  onBack: () => void;
}

interface TradeRoute {
  id: string;
  destination: string;
  resource: string;
  quantity: number;
  profit: number;
  duration: number;
  status: 'active' | 'completed' | 'pending';
}

interface MarketPrice {
  resource: string;
  price: number;
  trend: 'up' | 'down' | 'stable';
  change: number;
}

const RESOURCES = ['Gold', 'Food', 'Wood', 'Stone', 'Iron', 'Gems'];

const MARKET_PRICES: MarketPrice[] = [
  { resource: 'Gold', price: 1.0, trend: 'stable', change: 0 },
  { resource: 'Food', price: 0.8, trend: 'up', change: 0.15 },
  { resource: 'Wood', price: 1.2, trend: 'down', change: -0.08 },
  { resource: 'Stone', price: 1.5, trend: 'up', change: 0.22 },
  { resource: 'Iron', price: 2.1, trend: 'up', change: 0.35 },
  { resource: 'Gems', price: 5.0, trend: 'down', change: -0.12 }
];

const ECONOMIC_DATA = [
  { month: 'Jan', income: 4000, expenses: 2400, profit: 1600 },
  { month: 'Feb', income: 3000, expenses: 1398, profit: 1602 },
  { month: 'Mar', income: 2000, expenses: 2800, profit: -800 },
  { month: 'Apr', income: 2780, expenses: 3908, profit: -1128 },
  { month: 'May', income: 1890, expenses: 4800, profit: -2910 },
  { month: 'Jun', income: 2390, expenses: 3800, profit: -1410 }
];

const RESOURCE_DISTRIBUTION = [
  { name: 'Gold', value: 35, color: '#FFD700' },
  { name: 'Food', value: 25, color: '#8FBC8F' },
  { name: 'Wood', value: 15, color: '#8B4513' },
  { name: 'Stone', value: 12, color: '#696969' },
  { name: 'Iron', value: 8, color: '#708090' },
  { name: 'Gems', value: 5, color: '#9370DB' }
];

const TradeEconomyContent: React.FC<TradeEconomyProps> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'trade' | 'market'>('overview');
  const [tradeRoutes, setTradeRoutes] = useState<TradeRoute[]>([
    {
      id: '1',
      destination: 'Elven Alliance',
      resource: 'Wood',
      quantity: 500,
      profit: 600,
      duration: 120,
      status: 'active'
    },
    {
      id: '2',
      destination: 'Dwarven Stronghold',
      resource: 'Iron',
      quantity: 200,
      profit: 420,
      duration: 180,
      status: 'pending'
    }
  ]);

  const [newTrade, setNewTrade] = useState({
    destination: '',
    resource: 'Gold',
    quantity: 100
  });

  const handleCreateTrade = useCallback(() => {
    if (!newTrade.destination || newTrade.quantity <= 0) return;

    const marketPrice = MARKET_PRICES.find(p => p.resource === newTrade.resource)?.price || 1;
    const profit = Math.floor(newTrade.quantity * marketPrice * 0.2);

    const trade: TradeRoute = {
      id: Date.now().toString(),
      destination: newTrade.destination,
      resource: newTrade.resource,
      quantity: newTrade.quantity,
      profit,
      duration: 60 + Math.floor(Math.random() * 120),
      status: 'pending'
    };

    setTradeRoutes(prev => [...prev, trade]);
    setNewTrade({ destination: '', resource: 'Gold', quantity: 100 });
  }, [newTrade]);

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return '📈';
      case 'down': return '📉';
      default: return '➡️';
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'up': return '#10b981';
      case 'down': return '#ef4444';
      default: return '#6b7280';
    }
  };

  return (
    <div className="trade-economy">
      <div className="trade-header">
        <button onClick={onBack} className="back-button">
          ← Back to Kingdom
        </button>
        <div className="trade-title">
          <img src="/trade-economy-icon.png" alt="Trade & Economy" className="trade-icon" />
          <h1>Trade & Economy</h1>
        </div>
        <div className="kingdom-wealth">
          <span>Kingdom Wealth: {useKingdomStore.getState().resources.gold?.toLocaleString() || 0} Gold</span>
        </div>
      </div>

      <div className="tab-navigation">
        <button 
          className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <img src="/overview-analytics-icon.png" alt="Overview" className="tab-icon" />
          Overview
        </button>
        <button 
          className={`tab ${activeTab === 'trade' ? 'active' : ''}`}
          onClick={() => setActiveTab('trade')}
        >
          <img src="/trade-routes-icon.png" alt="Trade Routes" className="tab-icon" />
          Trade Routes
        </button>
        <button 
          className={`tab ${activeTab === 'market' ? 'active' : ''}`}
          onClick={() => setActiveTab('market')}
        >
          <img src="/market-prices-icon.png" alt="Market Prices" className="tab-icon" />
          Market Prices
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'overview' && (
          <div className="overview-tab">
            <div className="charts-grid">
              <div className="chart-container">
                <h3>Economic Performance</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={ECONOMIC_DATA}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="income" stroke="#10b981" strokeWidth={2} />
                    <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} />
                    <Line type="monotone" dataKey="profit" stroke="#3b82f6" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="chart-container">
                <h3>Resource Distribution</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={RESOURCE_DISTRIBUTION}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, percent }: { name: string; percent?: number }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                    >
                      {RESOURCE_DISTRIBUTION.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="economic-stats">
              <div className="stat-card">
                <h4>Monthly Income</h4>
                <div className="stat-value">2,390 Gold</div>
                <div className="stat-change positive">+12.5%</div>
              </div>
              <div className="stat-card">
                <h4>Trade Profit</h4>
                <div className="stat-value">1,020 Gold</div>
                <div className="stat-change positive">+8.3%</div>
              </div>
              <div className="stat-card">
                <h4>Active Routes</h4>
                <div className="stat-value">{tradeRoutes.filter(t => t.status === 'active').length}</div>
                <div className="stat-change neutral">Stable</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'trade' && (
          <div className="trade-tab">
            <div className="trade-creation">
              <h3>Create New Trade Route</h3>
              <div className="trade-form">
                <input
                  type="text"
                  placeholder="Destination Kingdom"
                  value={newTrade.destination}
                  onChange={(e) => setNewTrade(prev => ({ ...prev, destination: e.target.value }))}
                />
                <select
                  value={newTrade.resource}
                  onChange={(e) => setNewTrade(prev => ({ ...prev, resource: e.target.value }))}
                >
                  {RESOURCES.map(resource => (
                    <option key={resource} value={resource}>{resource}</option>
                  ))}
                </select>
                <input
                  type="number"
                  placeholder="Quantity"
                  value={newTrade.quantity}
                  onChange={(e) => setNewTrade(prev => ({ ...prev, quantity: parseInt(e.target.value) || 0 }))}
                />
                <button onClick={handleCreateTrade} className="create-trade-btn">
                  Create Route
                </button>
              </div>
            </div>

            <div className="trade-routes">
              <h3>Active Trade Routes</h3>
              <div className="routes-list">
                {tradeRoutes.map(route => (
                  <div key={route.id} className={`route-card ${route.status}`}>
                    <div className="route-info">
                      <h4>{route.destination}</h4>
                      <p>{route.quantity} {route.resource}</p>
                    </div>
                    <div className="route-stats">
                      <div className="profit">+{route.profit} Gold</div>
                      <div className="duration">{route.duration}min</div>
                      <div className={`status ${route.status}`}>
                        {route.status.charAt(0).toUpperCase() + route.status.slice(1)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'market' && (
          <div className="market-tab">
            <div className="market-prices">
              <h3>Current Market Prices</h3>
              <div className="prices-grid">
                {MARKET_PRICES.map(price => (
                  <div key={price.resource} className="price-card">
                    <div className="resource-name">{price.resource}</div>
                    <div className="price-value">{price.price.toFixed(2)} Gold</div>
                    <div className="price-trend" style={{ color: getTrendColor(price.trend) }}>
                      {getTrendIcon(price.trend)} {price.change > 0 ? '+' : ''}{(price.change * 100).toFixed(1)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="market-chart">
              <h3>Price Trends</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={MARKET_PRICES}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="resource" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="price" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};

export const TradeEconomy: React.FC<TradeEconomyProps> = (props) => {
  return (
    <ErrorBoundary fallback={
      <div className="trade-error">
        <h2>💰 Trade System Temporarily Unavailable</h2>
        <p>The markets are currently closed. Please try again later.</p>
        <button onClick={props.onBack}>← Back to Kingdom</button>
      </div>
    }>
      <TradeEconomyContent {...props} />
    </ErrorBoundary>
  );
};
