/**
 * Diplomacy Interface Component
 * Manages diplomatic relationships, treaties, and negotiations between kingdoms
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useDiplomacyStore } from '../stores/useDiplomacyStore';
import { ErrorBoundary } from './ErrorBoundary';

// Define types locally since they're used in this component
interface Kingdom {
  id: string;
  name: string;
  race: string;
  reputation: number;
}

interface TreatyProposal {
  id: string;
  fromKingdomId?: string;
  toKingdomId?: string;
  fromKingdom?: Kingdom;
  toKingdom?: Kingdom;
  type?: 'non-aggression' | 'trade' | 'military-alliance';
  treatyType?: string;
  terms: Record<string, string | number | boolean> | string;
  status?: string;
  createdAt: string;
}

interface DiplomacyInterfaceProps {
  kingdomId: string;
  onBack: () => void;
}

type DiplomacyView = 'dashboard' | 'relations' | 'proposals' | 'negotiate' | 'history';

const DiplomacyContent: React.FC<DiplomacyInterfaceProps> = ({ 
  kingdomId, 
  onBack 
}) => {
  const [currentView, setCurrentView] = useState<DiplomacyView>('dashboard');
  const [selectedKingdom, setSelectedKingdom] = useState<Kingdom | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    relationships,
    activeProposals,
    availableKingdoms,
    reputation,
    sendTreatyProposal,
    acceptTreatyProposal,
    rejectTreatyProposal,
    declareWar,
    loadDiplomacyData
  } = useDiplomacyStore();

  // Load initial diplomacy data
  useEffect(() => {
    loadDiplomacyData(kingdomId);
  }, [kingdomId, loadDiplomacyData]);

  const handleSendProposal = useCallback(async (proposal: Omit<TreatyProposal, 'id' | 'createdAt'>) => {
    try {
      setLoading(true);
      setError(null);
      await sendTreatyProposal({
        ...proposal,
        id: `proposal-${Date.now()}`,
        createdAt: new Date().toISOString(),
        fromKingdom: proposal.fromKingdom || {} as Kingdom,
        toKingdom: proposal.toKingdom || {} as Kingdom,
        treatyType: proposal.treatyType || 'trade'
      } as unknown as import('../types/diplomacy').TreatyProposal);
      setCurrentView('proposals');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send proposal');
    } finally {
      setLoading(false);
    }
  }, [sendTreatyProposal]);

  const handleAcceptProposal = useCallback(async (proposalId: string) => {
    try {
      setLoading(true);
      await acceptTreatyProposal(proposalId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept proposal');
    } finally {
      setLoading(false);
    }
  }, [acceptTreatyProposal]);

  const handleRejectProposal = useCallback(async (proposalId: string) => {
    try {
      setLoading(true);
      await rejectTreatyProposal(proposalId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject proposal');
    } finally {
      setLoading(false);
    }
  }, [rejectTreatyProposal]);

  const renderDiplomacyDashboard = () => (
    <div className="diplomacy-dashboard">
      <div className="diplomacy-stats">
        <div className="stat-card">
          <h4>Reputation</h4>
          <span className="stat-value reputation">{reputation}</span>
        </div>
        <div className="stat-card">
          <h4>Active Treaties</h4>
          <span className="stat-value">{relationships.filter(r => r.treaties.length > 0).length}</span>
        </div>
        <div className="stat-card">
          <h4>Pending Proposals</h4>
          <span className="stat-value">{activeProposals.length}</span>
        </div>
        <div className="stat-card">
          <h4>At War</h4>
          <span className="stat-value war">{relationships.filter(r => r.status === 'WAR').length}</span>
        </div>
      </div>

      <div className="recent-activity">
        <h3>Recent Diplomatic Activity</h3>
        {activeProposals.slice(0, 3).map(proposal => (
          <div key={proposal.id} className="activity-item">
            <div className="activity-icon">
              {proposal.treatyType === 'NON_AGGRESSION' ? '🕊️' : 
               proposal.treatyType === 'TRADE_AGREEMENT' ? '🤝' : '⚔️'}
            </div>
            <div className="activity-details">
              <p><strong>{proposal.fromKingdom.name}</strong> proposed {proposal.treatyType.toLowerCase().replace('_', ' ')}</p>
              <span className="activity-time">{proposal.createdAt.toLocaleDateString()}</span>
            </div>
          </div>
        ))}
        {activeProposals.length === 0 && (
          <p className="empty-state">No recent diplomatic activity</p>
        )}
      </div>
    </div>
  );

  const renderKingdomRelations = () => (
    <div className="kingdom-relations">
      <h3>Kingdom Relations</h3>
      <div className="relations-grid">
        {availableKingdoms.map(kingdom => {
          const relationship = relationships.find(r => 
            r.fromKingdom.id === kingdom.id || r.toKingdom.id === kingdom.id
          );
          
          return (
            <div key={kingdom.id} className="kingdom-card">
              <div className="kingdom-info">
                <img src={`/races/${kingdom.race}.png`} alt={kingdom.race} className="kingdom-flag" />
                <div className="kingdom-details">
                  <h4>{kingdom.name}</h4>
                  <p>{kingdom.race} Kingdom</p>
                  <span className={`status-badge ${relationship?.status.toLowerCase() || 'neutral'}`}>
                    {relationship?.status || 'NEUTRAL'}
                  </span>
                </div>
              </div>
              <div className="kingdom-actions">
                <button 
                  className="negotiate-btn"
                  onClick={() => {
                    setSelectedKingdom({ ...kingdom, reputation: kingdom.reputation || 0 });
                    setCurrentView('negotiate');
                  }}
                >
                  Negotiate
                </button>
                {relationship?.status !== 'WAR' && (
                  <button 
                    className="war-btn"
                    onClick={() => declareWar(kingdom.id)}
                  >
                    Declare War
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderTreatyProposals = () => (
    <div className="treaty-proposals">
      <h3>Treaty Proposals</h3>
      
      <div className="proposals-section">
        <h4>Incoming Proposals</h4>
        {activeProposals.filter(p => p.toKingdom.id === kingdomId).map(proposal => (
          <div key={proposal.id} className="proposal-card incoming">
            <div className="proposal-header">
              <img src={`/races/${proposal.fromKingdom.race}.png`} alt={proposal.fromKingdom.race} className="kingdom-flag" />
              <div className="proposal-info">
                <h5>{proposal.fromKingdom.name}</h5>
                <p>{proposal.treatyType.replace('_', ' ')}</p>
              </div>
            </div>
            <div className="proposal-terms">
              <p>{JSON.stringify(proposal.terms, null, 2)}</p>
            </div>
            <div className="proposal-actions">
              <button 
                className="accept-btn"
                onClick={() => handleAcceptProposal(proposal.id)}
                disabled={loading}
              >
                Accept
              </button>
              <button 
                className="reject-btn"
                onClick={() => handleRejectProposal(proposal.id)}
                disabled={loading}
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="proposals-section">
        <h4>Outgoing Proposals</h4>
        {activeProposals.filter(p => p.fromKingdom.id === kingdomId).map(proposal => (
          <div key={proposal.id} className="proposal-card outgoing">
            <div className="proposal-header">
              <img src={`/races/${proposal.toKingdom.race}.png`} alt={proposal.toKingdom.race} className="kingdom-flag" />
              <div className="proposal-info">
                <h5>To: {proposal.toKingdom.name}</h5>
                <p>{proposal.treatyType.replace('_', ' ')}</p>
              </div>
            </div>
            <div className="proposal-status">
              <span className="status-pending">Pending Response</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderTreatyNegotiation = () => {
    if (!selectedKingdom) return null;

    return (
      <div className="treaty-negotiation">
        <h3>Negotiate with {selectedKingdom.name}</h3>
        
        <div className="treaty-types">
          <button 
            className="treaty-type-btn"
            onClick={() => handleSendProposal({
              fromKingdom: { id: kingdomId, name: 'Your Kingdom', race: 'Human', reputation: 0 },
              toKingdom: selectedKingdom,
              treatyType: 'NON_AGGRESSION',
              terms: { duration: '30 days' },
              status: 'pending'
            })}
          >
            🕊️ Non-Aggression Pact
          </button>
          
          <button 
            className="treaty-type-btn"
            onClick={() => handleSendProposal({
              fromKingdom: { id: kingdomId, name: 'Your Kingdom', race: 'Human', reputation: 0 },
              toKingdom: selectedKingdom,
              treatyType: 'TRADE_AGREEMENT',
              terms: { tradeBonus: '10%', duration: '60 days' },
              status: 'pending'
            })}
          >
            🤝 Trade Agreement
          </button>
          
          <button 
            className="treaty-type-btn"
            onClick={() => handleSendProposal({
              fromKingdom: { id: kingdomId, name: 'Your Kingdom', race: 'Human', reputation: 0 },
              toKingdom: selectedKingdom,
              treatyType: 'MILITARY_ALLIANCE',
              terms: { mutualDefense: true, duration: '90 days' },
              status: 'pending'
            })}
          >
            ⚔️ Military Alliance
          </button>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    switch (currentView) {
      case 'relations':
        return renderKingdomRelations();
      case 'proposals':
        return renderTreatyProposals();
      case 'negotiate':
        return renderTreatyNegotiation();
      case 'history':
        return <div className="history">Diplomatic history coming soon!</div>;
      default:
        return renderDiplomacyDashboard();
    }
  };

  if (error) {
    return (
      <div className="diplomacy-error" role="alert">
        <h3>Diplomacy Error</h3>
        <p>{error}</p>
        <button onClick={() => setError(null)}>Dismiss</button>
      </div>
    );
  }

  return (
    <div className="diplomacy-interface">
      <div className="diplomacy-header">
        <button className="back-btn" onClick={onBack} aria-label="Back to Kingdom">
          ← Back to Kingdom
        </button>
        <h1><img src="/diplomacy-icon.png" style={{width:32,height:32,objectFit:'contain',verticalAlign:'middle',marginRight:8}} alt="" />Diplomacy</h1>
      </div>

      <nav className="diplomacy-navigation" role="navigation">
        <button 
          className={`nav-btn ${currentView === 'dashboard' ? 'active' : ''}`}
          onClick={() => setCurrentView('dashboard')}
        >
          Dashboard
        </button>
        <button 
          className={`nav-btn ${currentView === 'relations' ? 'active' : ''}`}
          onClick={() => setCurrentView('relations')}
        >
          Relations
        </button>
        <button 
          className={`nav-btn ${currentView === 'proposals' ? 'active' : ''}`}
          onClick={() => setCurrentView('proposals')}
        >
          Proposals
        </button>
        <button 
          className={`nav-btn ${currentView === 'history' ? 'active' : ''}`}
          onClick={() => setCurrentView('history')}
        >
          History
        </button>
      </nav>

      <main className="diplomacy-content">
        {renderContent()}
      </main>
    </div>
  );
};

const DiplomacyInterface: React.FC<DiplomacyInterfaceProps> = (props) => (
  <ErrorBoundary>
    <DiplomacyContent {...props} />
  </ErrorBoundary>
);

export default DiplomacyInterface;
