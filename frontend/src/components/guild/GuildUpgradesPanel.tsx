import React, { useState, useEffect } from 'react';
import { GuildService, type GuildData } from '../../services/GuildService';
import { ToastService } from '../../services/toastService';
import { isDemoMode } from '../../utils/authMode';

interface GuildUpgradesPanelProps {
  kingdom: { id: string; guildId?: string | null };
  currentGuild: GuildData | undefined;
}

const UPGRADE_DISPLAY = [
  { key: 'war_banner',    label: 'War Banner',      cost: '50k gold',  duration: '48h', desc: '+5% offense for all members', costNum: 50000 },
  { key: 'fortification', label: 'Fortification',   cost: '100k gold', duration: '7d',  desc: '+10% defense for all members', costNum: 100000 },
  { key: 'intel_network', label: 'Intel Network',   cost: '100k gold', duration: '7d',  desc: '+15% espionage success', costNum: 100000 },
  { key: 'trade_routes',  label: 'Trade Routes',    cost: '75k gold',  duration: '7d',  desc: '+10% income for all members', costNum: 75000 },
  { key: 'grand_assault', label: 'Grand Assault',   cost: '200k gold', duration: '24h', desc: '+25% offense on coordinated attacks', costNum: 200000 },
];

const GuildUpgradesPanel: React.FC<GuildUpgradesPanelProps> = ({ kingdom, currentGuild }) => {
  const [upgradeLoading, setUpgradeLoading] = useState<string | null>(null);
  const [upgradeNow, setUpgradeNow] = useState(Date.now());

  // Tick the countdown clock every 30s
  useEffect(() => {
    const id = setInterval(() => setUpgradeNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const treasury = currentGuild?.stats?.treasury ?? 0;
  const activeUpgrades = currentGuild?.stats?.activeUpgrades ?? [];
  const isLeader = currentGuild?.leaderId === kingdom.id;
  const demo = isDemoMode();

  const getCountdown = (expiresAt: string): string => {
    const ms = new Date(expiresAt).getTime() - upgradeNow;
    if (ms <= 0) return 'Expired';
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return `${h}h ${m}m remaining`;
  };

  const handlePurchase = async (upgradeKey: string) => {
    if (!kingdom.guildId || !isLeader || demo) return;
    try {
      setUpgradeLoading(upgradeKey);
      await GuildService.purchaseUpgrade(kingdom.guildId, kingdom.id, upgradeKey);
      ToastService.success('Upgrade purchased!');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to purchase upgrade';
      ToastService.error(msg);
    } finally {
      setUpgradeLoading(null);
    }
  };

  return (
    <div style={{ maxWidth: '800px' }}>
      {/* Treasury balance */}
      <div style={{
        padding: '1rem 1.25rem',
        background: 'rgba(78, 205, 196, 0.08)',
        border: '1px solid rgba(78, 205, 196, 0.3)',
        borderRadius: '10px',
        marginBottom: '1.5rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: '0.8rem', color: '#a0a0a0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Alliance Treasury
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#4ecdc4' }}>
            {treasury.toLocaleString()} gold
          </div>
        </div>
        {!isLeader && (
          <div style={{ fontSize: '0.8rem', color: '#a0a0a0', fontStyle: 'italic' }}>
            Only the alliance leader can purchase upgrades
          </div>
        )}
      </div>

      {/* Active upgrades */}
      {activeUpgrades.filter(u => new Date(u.expiresAt).getTime() > upgradeNow).length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ margin: '0 0 0.75rem', color: '#a0a0a0', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Active Upgrades
          </h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {activeUpgrades
              .filter(u => new Date(u.expiresAt).getTime() > upgradeNow)
              .map(u => {
                const def = UPGRADE_DISPLAY.find(d => d.key === u.key);
                return (
                  <div key={u.key} style={{
                    padding: '0.5rem 0.9rem',
                    background: 'rgba(78, 205, 196, 0.12)',
                    border: '1px solid rgba(78, 205, 196, 0.45)',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                  }}>
                    <span style={{ fontWeight: 600, color: '#4ecdc4' }}>
                      {def ? def.label : u.key}
                    </span>
                    <span style={{ color: '#a0a0a0', marginLeft: '0.5rem', fontSize: '0.78rem' }}>
                      {getCountdown(u.expiresAt)}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Upgrade shop */}
      <h4 style={{ margin: '0 0 0.75rem', color: '#a0a0a0', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Available Upgrades
      </h4>
      <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        {UPGRADE_DISPLAY.map(upg => {
          const isActive = activeUpgrades.some(
            u => u.key === upg.key && new Date(u.expiresAt).getTime() > upgradeNow
          );
          const canAfford = treasury >= upg.costNum;
          const isPurchasing = upgradeLoading === upg.key;

          return (
            <div key={upg.key} style={{
              padding: '1rem',
              background: isActive
                ? 'rgba(78, 205, 196, 0.08)'
                : 'rgba(255,255,255,0.03)',
              border: isActive
                ? '1px solid rgba(78, 205, 196, 0.45)'
                : '1px solid rgba(139, 92, 246, 0.3)',
              borderRadius: '8px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: isActive ? '#4ecdc4' : '#e2e8f0' }}>
                  {upg.label}
                </div>
                {isActive && (
                  <span style={{
                    padding: '0.15rem 0.5rem',
                    background: 'rgba(78, 205, 196, 0.2)',
                    border: '1px solid rgba(78, 205, 196, 0.5)',
                    borderRadius: '3px',
                    fontSize: '0.7rem',
                    color: '#4ecdc4',
                    fontWeight: 600,
                  }}>
                    ACTIVE
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.85rem', color: '#9ca3af', marginBottom: '0.5rem' }}>
                {upg.desc}
              </div>
              <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: '#a0a0a0', marginBottom: '0.75rem' }}>
                <span>Cost: <span style={{ color: '#f59e0b' }}>{upg.cost}</span></span>
                <span>Duration: <span style={{ color: '#e2e8f0' }}>{upg.duration}</span></span>
              </div>
              <button
                disabled={!isLeader || isActive || isPurchasing || demo}
                onClick={() => void handlePurchase(upg.key)}
                title={
                  demo ? 'Sign in for full features'
                  : !isLeader ? 'Only the alliance leader can purchase upgrades'
                  : isActive ? 'Already active'
                  : !canAfford ? 'Not enough gold in treasury'
                  : `Purchase ${upg.label}`
                }
                style={{
                  width: '100%',
                  padding: '0.4rem 0',
                  background: isActive
                    ? 'rgba(78,205,196,0.1)'
                    : !isLeader || demo || !canAfford
                    ? 'rgba(255,255,255,0.05)'
                    : 'linear-gradient(135deg, rgba(139,92,246,0.4), rgba(109,40,217,0.4))',
                  border: isActive
                    ? '1px solid rgba(78,205,196,0.3)'
                    : '1px solid rgba(139,92,246,0.4)',
                  borderRadius: '6px',
                  color: isActive || !isLeader || demo || !canAfford ? '#6b7280' : '#e2e8f0',
                  cursor: isActive || !isLeader || demo || !canAfford ? 'not-allowed' : 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  opacity: isPurchasing ? 0.6 : 1,
                }}
              >
                {isPurchasing ? 'Purchasing…' : isActive ? 'Active' : demo ? 'Sign in to Purchase' : 'Purchase'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default GuildUpgradesPanel;
