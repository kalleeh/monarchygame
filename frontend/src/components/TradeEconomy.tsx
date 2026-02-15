import React, { useState, useCallback } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ErrorBoundary } from './ErrorBoundary';
import { useKingdomStore } from '../stores/kingdomStore';
import type { Schema } from '../../../amplify/data/resource';

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

      <style>{`
        .trade-economy {
          min-height: 100vh;
          background: linear-gradient(135deg, #1f2937 0%, #374151 50%, #1f2937 100%);
          color: white;
        }

        .trade-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.5rem;
          background: rgba(0, 0, 0, 0.3);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .back-button {
          background: rgba(255, 255, 255, 0.1);
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.2);
          padding: 0.5rem 1rem;
          border-radius: 0.5rem;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .back-button:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        .kingdom-wealth {
          font-weight: bold;
          color: #fbbf24;
        }

        .tab-navigation {
          display: flex;
          background: rgba(0, 0, 0, 0.2);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .trade-title {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .trade-icon {
          width: 32px;
          height: 32px;
          object-fit: contain;
        }

        .tab {
          flex: 1;
          padding: 1rem;
          background: transparent;
          color: #9ca3af;
          border: none;
          cursor: pointer;
          transition: all 0.3s ease;
          border-bottom: 3px solid transparent;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          justify-content: center;
        }

        .tab-icon {
          width: 20px;
          height: 20px;
          object-fit: contain;
          opacity: 0.7;
          transition: opacity 0.3s ease;
        }

        .tab:hover .tab-icon,
        .tab.active .tab-icon {
          opacity: 1;
        }

        .tab:hover {
          background: rgba(255, 255, 255, 0.05);
          color: white;
        }

        .tab.active {
          color: white;
          border-bottom-color: #3b82f6;
          background: rgba(59, 130, 246, 0.1);
        }

        .tab-content {
          padding: 2rem;
        }

        .charts-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2rem;
          margin-bottom: 2rem;
        }

        .chart-container {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 1rem;
          padding: 1.5rem;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .chart-container h3 {
          margin: 0 0 1rem 0;
          color: #f8fafc;
        }

        .economic-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
        }

        .stat-card {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 0.5rem;
          padding: 1.5rem;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .stat-card h4 {
          margin: 0 0 0.5rem 0;
          color: #9ca3af;
          font-size: 0.9rem;
        }

        .stat-value {
          font-size: 1.5rem;
          font-weight: bold;
          color: white;
          margin-bottom: 0.5rem;
        }

        .stat-change {
          font-size: 0.8rem;
        }

        .stat-change.positive {
          color: #10b981;
        }

        .stat-change.negative {
          color: #ef4444;
        }

        .stat-change.neutral {
          color: #6b7280;
        }

        .trade-creation {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 1rem;
          padding: 1.5rem;
          margin-bottom: 2rem;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .trade-creation h3 {
          margin: 0 0 1rem 0;
          color: #f8fafc;
        }

        .trade-form {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr auto;
          gap: 1rem;
          align-items: center;
        }

        .trade-form input,
        .trade-form select {
          padding: 0.75rem;
          border-radius: 0.5rem;
          border: 1px solid rgba(255, 255, 255, 0.2);
          background: rgba(255, 255, 255, 0.1);
          color: white;
        }

        .trade-form input::placeholder {
          color: #9ca3af;
        }

        .create-trade-btn {
          background: #3b82f6;
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 0.5rem;
          cursor: pointer;
          transition: background-color 0.3s ease;
        }

        .create-trade-btn:hover {
          background: #2563eb;
        }

        .trade-routes h3 {
          margin: 0 0 1rem 0;
          color: #f8fafc;
        }

        .routes-list {
          display: grid;
          gap: 1rem;
        }

        .route-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 0.5rem;
          padding: 1rem;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .route-card.active {
          border-color: #10b981;
          background: rgba(16, 185, 129, 0.1);
        }

        .route-card.pending {
          border-color: #f59e0b;
          background: rgba(245, 158, 11, 0.1);
        }

        .route-info h4 {
          margin: 0 0 0.25rem 0;
          color: white;
        }

        .route-info p {
          margin: 0;
          color: #9ca3af;
        }

        .route-stats {
          display: flex;
          gap: 1rem;
          align-items: center;
        }

        .profit {
          color: #10b981;
          font-weight: bold;
        }

        .duration {
          color: #9ca3af;
        }

        .status {
          padding: 0.25rem 0.75rem;
          border-radius: 0.25rem;
          font-size: 0.8rem;
          font-weight: bold;
        }

        .status.active {
          background: #10b981;
          color: white;
        }

        .status.pending {
          background: #f59e0b;
          color: white;
        }

        .prices-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .price-card {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 0.5rem;
          padding: 1rem;
          border: 1px solid rgba(255, 255, 255, 0.1);
          text-align: center;
        }

        .resource-name {
          font-weight: bold;
          color: white;
          margin-bottom: 0.5rem;
        }

        .price-value {
          font-size: 1.25rem;
          color: #fbbf24;
          margin-bottom: 0.5rem;
        }

        .price-trend {
          font-size: 0.9rem;
          font-weight: bold;
        }

        .market-chart {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 1rem;
          padding: 1.5rem;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .market-chart h3 {
          margin: 0 0 1rem 0;
          color: #f8fafc;
        }

        @media (max-width: 768px) {
          .charts-grid {
            grid-template-columns: 1fr;
          }

          .trade-form {
            grid-template-columns: 1fr;
          }

          .route-card {
            flex-direction: column;
            align-items: flex-start;
            gap: 1rem;
          }

          .route-stats {
            width: 100%;
            justify-content: space-between;
          }
        }
      `}</style>
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
