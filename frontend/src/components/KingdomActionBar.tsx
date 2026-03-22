import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRestorationStore } from '../stores/restorationStore';
import UnitRoster from './UnitRoster';
import { HelpModal } from './ui/HelpModal';
import './KingdomActionBar.css';

interface ActionItem {
  icon?: string;
  emoji?: string;
  label: string;
  onClick: () => void;
  prohibitedAction?: string;
}

interface ActionGroup {
  key: string;
  emoji: string;
  label: string;
  items: ActionItem[];
}

interface KingdomActionBarProps {
  kingdom: { id: string };
  onManageCombat?: () => void;
  onSummonUnits?: () => void;
  onCastSpells?: () => void;
  onManageAlliance?: () => void;
  onManageTrade?: () => void;
  onDiplomacy?: () => void;
  onManageTerritories?: () => void;
  onManageBuildings?: () => void;
  onViewWorldMap?: () => void;
  onBattleReports?: () => void;
  onViewLeaderboard?: () => void;
  isActionProhibited: (action: string) => boolean;
  onShowUnitRoster: () => void;
  onShowHelp: () => void;
}

export const KingdomActionBar: React.FC<KingdomActionBarProps> = ({
  kingdom,
  onManageCombat,
  onSummonUnits,
  onCastSpells,
  onManageAlliance,
  onManageTrade,
  onDiplomacy,
  onManageTerritories,
  onManageBuildings,
  onViewWorldMap,
  onBattleReports,
  onViewLeaderboard,
  isActionProhibited,
  onShowUnitRoster,
  onShowHelp,
}) => {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  const groups: ActionGroup[] = [
    {
      key: 'kingdom',
      emoji: '🏛️',
      label: 'Kingdom',
      items: [
        { icon: '/territories-icon.png', label: 'Manage Territories', onClick: () => onManageTerritories?.() },
        { icon: '/buildings-economy-icon.png', label: 'Construct Buildings', onClick: () => onManageBuildings?.() },
        { icon: '/world-map-icon.png', label: 'World Map', onClick: () => onViewWorldMap?.() },
        { emoji: '🎯', label: 'Bounty Board', onClick: () => navigate(`/kingdom/${kingdom.id}/bounties`) },
        { emoji: '🙏', label: 'Faith & Focus', onClick: () => navigate(`/kingdom/${kingdom.id}/faith`) },
      ],
    },
    {
      key: 'warfare',
      emoji: '⚔️',
      label: 'Warfare',
      items: [
        { icon: '/combat-icon.png', label: 'Combat Operations', onClick: () => onManageCombat?.(), prohibitedAction: 'combat_attacks' },
        { icon: '/train-units-icon.png', label: 'Summon Units', onClick: () => onSummonUnits?.(), prohibitedAction: 'train' },
        { icon: '/magic-spells-icon.png', label: 'Cast Spells', onClick: () => onCastSpells?.(), prohibitedAction: 'sorcery_casting' },
        { emoji: '🕵️', label: 'Espionage', onClick: () => navigate(`/kingdom/${kingdom.id}/espionage`), prohibitedAction: 'espionage_operations' },
        { icon: '/battle-reports-icon.png', label: 'Battle History', onClick: () => onBattleReports?.() },
      ],
    },
    {
      key: 'social',
      emoji: '🤝',
      label: 'Social',
      items: [
        { icon: '/alliance-icon.png', label: 'Alliance Management', onClick: () => onManageAlliance?.(), prohibitedAction: 'alliance_changes' },
        { icon: '/trade-economy-icon.png', label: 'Trade', onClick: () => onManageTrade?.(), prohibitedAction: 'diplomatic_actions' },
        { icon: '/diplomacy-icon.png', label: 'Diplomacy', onClick: () => onDiplomacy?.(), prohibitedAction: 'diplomatic_actions' },
        { emoji: '🏆', label: 'Kingdom Scrolls', onClick: () => onViewLeaderboard?.() },
      ],
    },
  ];

  // Close on outside click
  useEffect(() => {
    if (!expanded) return;
    const handleClick = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [expanded]);

  // Close on ESC
  useEffect(() => {
    if (!expanded) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [expanded]);

  const handleItemClick = useCallback((item: ActionItem, prohibited: boolean) => {
    if (prohibited) return;
    setExpanded(false);
    item.onClick();
  }, []);

  return (
    <div className="action-bar-sticky" ref={barRef}>
      <div className="action-bar-inner">

        {/* ── Minimized icon strip ── */}
        <div className="action-bar-strip">
          {groups.map((group, groupIdx) => (
            <React.Fragment key={group.key}>
              {groupIdx > 0 && <div className="action-bar-divider" />}
              <span className="action-bar-group-label" title={group.label}>
                {group.emoji}
              </span>
              {group.items.map((item) => {
                const prohibited = item.prohibitedAction ? isActionProhibited(item.prohibitedAction) : false;
                return (
                  <button
                    key={item.label}
                    className={`action-bar-icon-btn${prohibited ? ' action-bar-icon-btn--disabled' : ''}`}
                    onClick={() => handleItemClick(item, prohibited)}
                    title={prohibited ? `${item.label} (restricted)` : item.label}
                    disabled={prohibited}
                  >
                    {item.icon
                      ? <img src={item.icon} alt={item.label} className="action-bar-icon" />
                      : <span className="action-bar-emoji">{item.emoji}</span>
                    }
                  </button>
                );
              })}
            </React.Fragment>
          ))}

          {/* Right-side controls */}
          <div className="action-bar-right">
            <button
              className="action-bar-util-btn"
              onClick={onShowUnitRoster}
              title="Unit tier reference panel"
            >
              ? Units
            </button>
            <button
              className="action-bar-util-btn action-bar-util-btn--teal"
              onClick={onShowHelp}
              title="Quick reference guide"
            >
              ? Help
            </button>
            <button
              className={`action-bar-expand-btn${expanded ? ' action-bar-expand-btn--open' : ''}`}
              onClick={() => setExpanded((v) => !v)}
              title={expanded ? 'Collapse menu' : 'Expand menu'}
              aria-expanded={expanded}
            >
              <span className="action-bar-chevron">{expanded ? '▲' : '▼'}</span>
              <span className="action-bar-expand-label">{expanded ? 'Collapse' : 'Expand'}</span>
            </button>
          </div>
        </div>

        {/* ── Expanded dropdown panel ── */}
        {expanded && (
          <div className="action-bar-dropdown">
            {groups.map((group) => (
              <div key={group.key} className="action-bar-dropdown-group">
                <h4 className="action-bar-dropdown-group-header">
                  {group.emoji} {group.label}
                </h4>
                <div className="action-bar-dropdown-buttons">
                  {group.items.map((item) => {
                    const prohibited = item.prohibitedAction ? isActionProhibited(item.prohibitedAction) : false;
                    return (
                      <button
                        key={item.label}
                        className={`action-btn${prohibited ? ' opacity-50 cursor-not-allowed' : ''}`}
                        onClick={() => handleItemClick(item, prohibited)}
                        disabled={prohibited}
                        title={prohibited ? 'In restoration — action prohibited' : undefined}
                      >
                        {item.icon
                          ? <img src={item.icon} alt={item.label} className="action-icon" />
                          : <span style={{ marginRight: '0.5rem' }}>{item.emoji}</span>
                        }
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
};

/**
 * Self-contained action bar for use outside KingdomDashboard.
 * Reads prohibited actions from restorationStore directly.
 * All navigation uses the router — no callbacks needed.
 */
export const KingdomActionBarConnected: React.FC<{ kingdomId: string }> = ({ kingdomId }) => {
  const navigate = useNavigate();
  const isInRestoration = useRestorationStore((s) => s.isInRestoration);
  const prohibitedActions = useRestorationStore((s) => s.prohibitedActions);
  const [showUnitRoster, setShowUnitRoster] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const isActionProhibited = (action: string) =>
    isInRestoration && prohibitedActions.includes(action);

  return (
    <>
      <KingdomActionBar
        kingdom={{ id: kingdomId }}
        onManageTerritories={() => navigate(`/kingdom/${kingdomId}/territories`)}
        onManageBuildings={() => navigate(`/kingdom/${kingdomId}/buildings`)}
        onViewWorldMap={() => navigate(`/kingdom/${kingdomId}/worldmap`)}
        onManageCombat={() => navigate(`/kingdom/${kingdomId}/combat`)}
        onSummonUnits={() => navigate(`/kingdom/${kingdomId}/summon`)}
        onCastSpells={() => navigate(`/kingdom/${kingdomId}/magic`)}
        onManageAlliance={() => navigate(`/kingdom/${kingdomId}/alliance`)}
        onManageTrade={() => navigate(`/kingdom/${kingdomId}/trade`)}
        onDiplomacy={() => navigate(`/kingdom/${kingdomId}/diplomacy`)}
        onBattleReports={() => navigate(`/kingdom/${kingdomId}/reports`)}
        onViewLeaderboard={() => navigate(`/kingdom/${kingdomId}/leaderboard`)}
        isActionProhibited={isActionProhibited}
        onShowUnitRoster={() => setShowUnitRoster(true)}
        onShowHelp={() => setShowHelp(true)}
      />
      {showUnitRoster && <UnitRoster onClose={() => setShowUnitRoster(false)} />}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </>
  );
};
