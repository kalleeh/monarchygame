import React, { useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  KingdomIcon, WarfareIcon, SocialIcon, CombatIcon, TrainUnitsIcon, MagicSpellsIcon,
  EspionageIcon, BattleReportsIcon, TerritoriesIcon, BuildingsIcon, WorldMapIcon,
  BountyIcon, FaithIcon, AllianceIcon, TradeIcon, DiplomacyIcon, LeaderboardIcon,
  ScrollIcon, InfoIcon, LockIcon,
} from './ui/MenuIcons';
import './MobileBottomNav.css';

interface MobileBottomNavProps {
  kingdomId: string;
  isActionProhibited: (action: string) => boolean;
  onShowUnitRoster: () => void;
  onShowHelp: () => void;
}

interface TrayItem {
  label: string;
  svgIcon: React.ReactNode;
  path?: string;
  prohibitedAction?: string;
  onAction?: () => void;
}

interface Tab {
  key: string;
  svgIcon: React.ReactNode;
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
      svgIcon: <KingdomIcon />,
      label: 'Home',
      directPath: `/kingdom/${kingdomId}`,
    },
    {
      key: 'war',
      svgIcon: <WarfareIcon />,
      label: 'War',
      trayItems: [
        { label: 'Combat Operations', svgIcon: <CombatIcon />, path: `/kingdom/${kingdomId}/combat`, prohibitedAction: 'combat_attacks' },
        { label: 'Summon Units', svgIcon: <TrainUnitsIcon />, path: `/kingdom/${kingdomId}/summon`, prohibitedAction: 'train' },
        { label: 'Cast Spells', svgIcon: <MagicSpellsIcon />, path: `/kingdom/${kingdomId}/magic`, prohibitedAction: 'sorcery_casting' },
        { label: 'Espionage', svgIcon: <EspionageIcon />, path: `/kingdom/${kingdomId}/espionage`, prohibitedAction: 'espionage_operations' },
        { label: 'Battle History', svgIcon: <BattleReportsIcon />, path: `/kingdom/${kingdomId}/reports` },
      ],
    },
    {
      key: 'kingdom',
      svgIcon: <KingdomIcon />,
      label: 'Kingdom',
      trayItems: [
        { label: 'Territories', svgIcon: <TerritoriesIcon />, path: `/kingdom/${kingdomId}/territories` },
        { label: 'Buildings', svgIcon: <BuildingsIcon />, path: `/kingdom/${kingdomId}/buildings` },
        { label: 'World Map', svgIcon: <WorldMapIcon />, path: `/kingdom/${kingdomId}/worldmap` },
        { label: 'Bounty Board', svgIcon: <BountyIcon />, path: `/kingdom/${kingdomId}/bounties` },
        { label: 'Faith & Focus', svgIcon: <FaithIcon />, path: `/kingdom/${kingdomId}/faith` },
      ],
    },
    {
      key: 'social',
      svgIcon: <SocialIcon />,
      label: 'Social',
      trayItems: [
        { label: 'Alliance', svgIcon: <AllianceIcon />, path: `/kingdom/${kingdomId}/alliance`, prohibitedAction: 'alliance_changes' },
        { label: 'Trade', svgIcon: <TradeIcon />, path: `/kingdom/${kingdomId}/trade`, prohibitedAction: 'diplomatic_actions' },
        { label: 'Diplomacy', svgIcon: <DiplomacyIcon />, path: `/kingdom/${kingdomId}/diplomacy`, prohibitedAction: 'diplomatic_actions' },
        { label: 'Leaderboard', svgIcon: <LeaderboardIcon />, path: `/kingdom/${kingdomId}/leaderboard` },
      ],
    },
    {
      key: 'more',
      svgIcon: <ScrollIcon />,
      label: 'More',
      trayItems: [
        { label: 'Units', svgIcon: <ScrollIcon />, onAction: onShowUnitRoster },
        { label: 'Help', svgIcon: <InfoIcon />, onAction: onShowHelp },
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
              <span style={{ display: 'inline-flex', verticalAlign: 'middle', marginRight: '0.3rem' }}>{openTab.svgIcon}</span> {openTab.label}
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
                  <span className="mobile-bottom-nav__tray-item-icon" style={{ display: 'inline-flex' }}>{item.svgIcon}</span>
                  <span className="mobile-bottom-nav__tray-item-label">{item.label}</span>
                  {prohibited && <span className="mobile-bottom-nav__tray-item-lock"><LockIcon /></span>}
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
              <span className="mobile-bottom-nav__tab-icon" style={{ display: 'inline-flex' }}>{tab.svgIcon}</span>
              <span className="mobile-bottom-nav__tab-label">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
