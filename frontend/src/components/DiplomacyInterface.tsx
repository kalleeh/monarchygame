/**
 * Diplomacy Interface Component
 * Manages diplomatic relationships, treaties, and negotiations between kingdoms
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useDiplomacyStore } from '../stores/useDiplomacyStore';
import { ErrorBoundary } from './ErrorBoundary';
import './DiplomacyInterface.css';

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
    diplomaticHistory,
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
      <div className="diplomacy-stats gm-stat-grid">
        <div className="gm-stat-card">
          <span className="gm-stat-card__label">Reputation</span>
          <span className="gm-stat-card__value" style={{ color: '#22c55e' }}>{reputation}</span>
        </div>
        <div className="gm-stat-card">
          <span className="gm-stat-card__label">Active Treaties</span>
          <span className="gm-stat-card__value">{relationships.filter(r => r.treaties.length > 0).length}</span>
        </div>
        <div className="gm-stat-card">
          <span className="gm-stat-card__label">Pending Proposals</span>
          <span className="gm-stat-card__value">{activeProposals.length}</span>
        </div>
        <div className="gm-stat-card">
          <span className="gm-stat-card__label">At War</span>
          <span className="gm-stat-card__value" style={{ color: '#ef4444' }}>{relationships.filter(r => r.status === 'WAR').length}</span>
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
              <p>
                <strong>{proposal.fromKingdom?.name ?? 'Unknown Kingdom'}</strong>
                {' proposed '}
                {(proposal.treatyType ?? '').toLowerCase().replace(/_/g, ' ')}
              </p>
              <span className="activity-time">
                {proposal.createdAt instanceof Date
                  ? proposal.createdAt.toLocaleDateString()
                  : new Date(proposal.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        ))}
        {activeProposals.length === 0 && (
          <p className="gm-empty-state">No recent diplomatic activity</p>
        )}
      </div>
    </div>
  );

  const renderKingdomRelations = () => (
    <div className="kingdom-relations">
      <h3>Kingdom Relations</h3>
      {availableKingdoms.length === 0 ? (
        <p className="gm-empty-state">No kingdoms available for diplomacy.</p>
      ) : (
        <div className="relations-grid">
          {availableKingdoms.map(kingdom => {
            const relationship = relationships.find(r =>
              r.fromKingdom.id === kingdom.id || r.toKingdom.id === kingdom.id
            );
            const statusText = relationship?.status || 'NEUTRAL';
            const statusClass = statusText.toLowerCase();

            return (
              <div key={kingdom.id} className="kingdom-card gm-card">
                <div className="kingdom-info">
                  <div className="kingdom-flag" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.75rem' }}>🏰</div>
                  <div className="kingdom-details">
                    <h4>{kingdom.name}</h4>
                    <p>{kingdom.race} Kingdom</p>
                    <span className={`status-badge ${statusClass}`}>
                      {statusText}
                    </span>
                  </div>
                </div>
                <div className="kingdom-actions">
                  <button
                    className="negotiate-btn gm-btn gm-btn--primary"
                    onClick={() => {
                      setSelectedKingdom({ ...kingdom, reputation: kingdom.reputation || 0 });
                      setCurrentView('negotiate');
                    }}
                  >
                    Negotiate
                  </button>
                  {relationship?.status !== 'WAR' && (
                    <button
                      className="war-btn gm-btn gm-btn--danger"
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
      )}
    </div>
  );

  const renderTreatyProposals = () => {
    const incoming = activeProposals.filter(p => p.toKingdom?.id === kingdomId || p.toKingdom?.id === 'player-kingdom');
    const outgoing = activeProposals.filter(p => p.fromKingdom?.id === kingdomId);
    return (
      <div className="treaty-proposals">
        <h3>Treaty Proposals</h3>

        <div className="proposals-section">
          <h4>Incoming Proposals</h4>
          {incoming.length === 0 ? (
            <p className="gm-empty-state">No incoming proposals.</p>
          ) : incoming.map(proposal => (
            <div key={proposal.id} className="proposal-card incoming gm-card">
              <div className="proposal-header">
                <div className="kingdom-flag" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>🏰</div>
                <div className="proposal-info">
                  <h5>{proposal.fromKingdom?.name ?? 'Unknown Kingdom'}</h5>
                  <p>{(proposal.treatyType ?? '').replace(/_/g, ' ')}</p>
                </div>
              </div>
              <div className="proposal-terms">
                <p>{typeof proposal.terms === 'string' ? proposal.terms : JSON.stringify(proposal.terms, null, 2)}</p>
              </div>
              <div className="proposal-actions">
                <button
                  className="accept-btn gm-btn gm-btn--primary"
                  onClick={() => handleAcceptProposal(proposal.id)}
                  disabled={loading}
                >
                  Accept
                </button>
                <button
                  className="reject-btn gm-btn gm-btn--danger"
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
          {outgoing.length === 0 ? (
            <p className="gm-empty-state">No outgoing proposals.</p>
          ) : outgoing.map(proposal => (
            <div key={proposal.id} className="proposal-card outgoing gm-card">
              <div className="proposal-header">
                <div className="kingdom-flag" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>🏰</div>
                <div className="proposal-info">
                  <h5>To: {proposal.toKingdom?.name ?? 'Unknown Kingdom'}</h5>
                  <p>{(proposal.treatyType ?? '').replace(/_/g, ' ')}</p>
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
  };

  const renderTreatyNegotiation = () => {
    if (!selectedKingdom) return null;

    return (
      <div className="treaty-negotiation">
        <h3>Negotiate with {selectedKingdom.name}</h3>
        
        <div className="treaty-types">
          <button
            className="treaty-type-btn gm-btn gm-btn--ghost"
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
            className="treaty-type-btn gm-btn gm-btn--ghost"
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
            className="treaty-type-btn gm-btn gm-btn--ghost"
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
        return (
          <div className="diplomatic-history">
            <h3>Diplomatic History</h3>
            {diplomaticHistory.length === 0 ? (
              <p className="gm-empty-state">No diplomatic actions recorded yet.</p>
            ) : (
              <div className="history-list">
                {diplomaticHistory.map(action => (
                  <div key={action.id} className="history-item gm-card">
                    <div className="history-item-header">
                      <span className="history-action-type">{(action.type ?? '').replace(/_/g, ' ')}</span>
                      <span className="history-timestamp">
                        {action.timestamp instanceof Date
                          ? action.timestamp.toLocaleDateString()
                          : new Date(action.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="history-details">{action.details}</p>
                    <p className="history-kingdoms">
                      <span style={{ color: '#fbbf24' }}>{action.fromKingdom?.name ?? 'Unknown'}</span>
                      {' → '}
                      <span style={{ color: '#94a3b8' }}>{action.toKingdom?.name ?? 'Unknown'}</span>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      default:
        return renderDiplomacyDashboard();
    }
  };

  if (error) {
    return (
      <div className="gm-error-banner" role="alert" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.75rem', borderRadius: '0.5rem', padding: '1.5rem' }}>
        <strong>Diplomacy Error</strong>
        <p style={{ margin: 0 }}>{error}</p>
        <button onClick={() => setError(null)}>Dismiss</button>
      </div>
    );
  }

  return (
    <div className="diplomacy-interface">
      <div className="diplomacy-header">
        <button className="gm-back-btn" onClick={onBack} aria-label="Back to Kingdom">
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
