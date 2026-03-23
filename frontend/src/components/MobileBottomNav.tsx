import React, { useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './MobileBottomNav.css';

interface MobileBottomNavProps {
  kingdomId: string;
  isActionProhibited: (action: string) => boolean;
  onShowUnitRoster: () => void;
  onShowHelp: () => void;
}

interface TrayItem {
  label: string;
  emoji: string;
  path?: string;
  prohibitedAction?: string;
  onAction?: () => void;
}

interface Tab {
  key: string;
  icon: string;
  label: string;
  trayItems?: TrayItem[];
  directPath?: string;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  kingdomId,
  isActionProhibited,
  onShowUnitRoster,
  onShowHelp,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [openTray, setOpenTray] = useState<string | null>(null);

  const tabs: Tab[] = [
    {
      key: 'home',
      icon: '🏠',
      label: 'Home',
      directPath: `/kingdom/${kingdomId}`,
    },
    {
      key: 'war',
      icon: '⚔️',
      label: 'War',
      trayItems: [
        { label: 'Combat Operations', emoji: '⚔️', path: `/kingdom/${kingdomId}/combat`, prohibitedAction: 'combat_attacks' },
        { label: 'Summon Units', emoji: '🪖', path: `/kingdom/${kingdomId}/summon`, prohibitedAction: 'train' },
        { label: 'Cast Spells', emoji: '✨', path: `/kingdom/${kingdomId}/magic`, prohibitedAction: 'sorcery_casting' },
        { label: 'Espionage', emoji: '🕵️', path: `/kingdom/${kingdomId}/espionage`, prohibitedAction: 'espionage_operations' },
        { label: 'Battle History', emoji: '📜', path: `/kingdom/${kingdomId}/reports` },
      ],
    },
    {
      key: 'kingdom',
      icon: '🏛️',
      label: 'Kingdom',
      trayItems: [
        { label: 'Territories', emoji: '🗺️', path: `/kingdom/${kingdomId}/territories` },
        { label: 'Buildings', emoji: '🏗️', path: `/kingdom/${kingdomId}/buildings` },
        { label: 'World Map', emoji: '🌍', path: `/kingdom/${kingdomId}/worldmap` },
        { label: 'Bounty Board', emoji: '🎯', path: `/kingdom/${kingdomId}/bounties` },
        { label: 'Faith & Focus', emoji: '🙏', path: `/kingdom/${kingdomId}/faith` },
      ],
    },
    {
      key: 'social',
      icon: '🤝',
      label: 'Social',
      trayItems: [
        { label: 'Alliance', emoji: '🛡️', path: `/kingdom/${kingdomId}/alliance`, prohibitedAction: 'alliance_changes' },
        { label: 'Trade', emoji: '💰', path: `/kingdom/${kingdomId}/trade`, prohibitedAction: 'diplomatic_actions' },
        { label: 'Diplomacy', emoji: '📜', path: `/kingdom/${kingdomId}/diplomacy`, prohibitedAction: 'diplomatic_actions' },
        { label: 'Leaderboard', emoji: '🏆', path: `/kingdom/${kingdomId}/leaderboard` },
      ],
    },
    {
      key: 'more',
      icon: '☰',
      label: 'More',
      trayItems: [
        { label: '? Units', emoji: '📋', onAction: onShowUnitRoster },
        { label: '? Help', emoji: '❓', onAction: onShowHelp },
      ],
    },
  ];

  const getActiveTabKey = (): string => {
    const path = location.pathname;
    if (path === `/kingdom/${kingdomId}` || path === `/kingdom/${kingdomId}/`) return 'home';
    if (path.includes('/combat') || path.includes('/summon') || path.includes('/magic') || path.includes('/espionage') || path.includes('/reports')) return 'war';
    if (path.includes('/territories') || path.includes('/buildings') || path.includes('/worldmap') || path.includes('/bounties') || path.includes('/faith')) return 'kingdom';
    if (path.includes('/alliance') || path.includes('/trade') || path.includes('/diplomacy') || path.includes('/leaderboard')) return 'social';
    return '';
  };

  const activeTabKey = getActiveTabKey();

  const handleTabPress = useCallback((tab: Tab) => {
    if (tab.directPath) {
      setOpenTray(null);
      navigate(tab.directPath);
      return;
    }
    setOpenTray((prev) => (prev === tab.key ? null : tab.key));
  }, [navigate]);

  const handleTrayItemPress = useCallback((item: TrayItem, prohibited: boolean) => {
    if (prohibited) return;
    setOpenTray(null);
    if (item.path) {
      navigate(item.path);
    } else if (item.onAction) {
      item.onAction();
    }
  }, [navigate]);

  const handleBackdropPress = useCallback(() => {
    setOpenTray(null);
  }, []);

  const openTab = tabs.find((t) => t.key === openTray);

  return (
    <div className="mobile-bottom-nav">
      {/* Backdrop — closes tray on tap */}
      {openTray && (
        <div
          className="mobile-bottom-nav__backdrop"
          onClick={handleBackdropPress}
          aria-hidden="true"
        />
      )}

      {/* Sub-tray */}
      {openTab?.trayItems && (
        <div className={`mobile-bottom-nav__tray${openTray ? ' mobile-bottom-nav__tray--open' : ''}`}>
          <div className="mobile-bottom-nav__tray-header">
            <span className="mobile-bottom-nav__tray-title">
              {openTab.icon} {openTab.label}
            </span>
            <button
              className="mobile-bottom-nav__tray-close"
              onClick={() => setOpenTray(null)}
              aria-label="Close menu"
            >
              ✕
            </button>
          </div>
          <div className="mobile-bottom-nav__tray-grid">
            {openTab.trayItems.map((item) => {
              const prohibited = item.prohibitedAction ? isActionProhibited(item.prohibitedAction) : false;
              return (
                <button
                  key={item.label}
                  className={`mobile-bottom-nav__tray-item${prohibited ? ' mobile-bottom-nav__tray-item--prohibited' : ''}`}
                  onClick={() => handleTrayItemPress(item, prohibited)}
                  disabled={prohibited}
                  title={prohibited ? `${item.label} (restricted)` : item.label}
                >
                  <span className="mobile-bottom-nav__tray-item-icon">{item.emoji}</span>
                  <span className="mobile-bottom-nav__tray-item-label">{item.label}</span>
                  {prohibited && <span className="mobile-bottom-nav__tray-item-lock">🔒</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab bar */}
      <nav className="mobile-bottom-nav__bar">
        {tabs.map((tab) => {
          const isActive = activeTabKey === tab.key;
          const isOpen = openTray === tab.key;
          return (
            <button
              key={tab.key}
              className={`mobile-bottom-nav__tab${isActive ? ' mobile-bottom-nav__tab--active' : ''}${isOpen ? ' mobile-bottom-nav__tab--open' : ''}`}
              onClick={() => handleTabPress(tab)}
              aria-label={tab.label}
              aria-expanded={tab.trayItems ? isOpen : undefined}
            >
              <span className="mobile-bottom-nav__tab-icon">{tab.icon}</span>
              <span className="mobile-bottom-nav__tab-label">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
