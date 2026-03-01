import { useState, useEffect, memo } from 'react';
import { isDemoMode } from '../../utils/authMode';
import { TURN_MECHANICS } from '../../../../shared/mechanics/turn-mechanics';

export const EncampPanel = memo(({
  kingdomId,
  encampEndTimeMs,
  encampBonusTurns: encampBonusTurnsProp,
  onEncamp,
  encampLoading,
}: {
  kingdomId: string;
  encampEndTimeMs: number | null;
  encampBonusTurns: number;
  onEncamp: (duration: 16 | 24) => void;
  encampLoading: boolean;
}) => {
  const [now, setNow] = useState(() => Date.now());
  // Demo-mode fallback: read/poll localStorage
  const [demoEndTime, setDemoEndTime] = useState<number | null>(null);
  const [demoBonusTurns, setDemoBonusTurns] = useState<number>(0);

  useEffect(() => {
    const tick = () => {
      setNow(Date.now());
      if (isDemoMode()) {
        try {
          const raw = localStorage.getItem(`encamp-${kingdomId}`);
          if (raw) {
            const data = JSON.parse(raw) as { endTime: number; bonusTurns: number };
            setDemoEndTime(data.endTime);
            setDemoBonusTurns(data.bonusTurns);
          } else {
            setDemoEndTime(null);
            setDemoBonusTurns(0);
          }
        } catch {
          setDemoEndTime(null);
          setDemoBonusTurns(0);
        }
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [kingdomId]);

  // Resolve active state: server data in auth mode, localStorage in demo mode
  const activeEndTime = isDemoMode() ? demoEndTime : encampEndTimeMs;
  const activeBonusTurns = isDemoMode() ? demoBonusTurns : encampBonusTurnsProp;
  const isActive = activeEndTime !== null && now < activeEndTime;

  const formatCountdown = (ms: number) => {
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
  };

  return (
    <div className="encamp-panel" style={{
      marginTop: '1rem',
      padding: '1rem',
      background: 'rgba(78, 205, 196, 0.08)',
      border: '1px solid rgba(78, 205, 196, 0.25)',
      borderRadius: '8px'
    }}>
      <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem', color: 'var(--primary)' }}>
        Encamp
      </h4>
      {isActive ? (
        <div>
          <p style={{ margin: '0 0 0.25rem', fontSize: '0.85rem', color: '#a0a0a0' }}>
            Kingdom is resting — {formatCountdown(activeEndTime! - now)} remaining
          </p>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#4ecdc4' }}>
            +{activeBonusTurns} bonus turns when you return
          </p>
        </div>
      ) : (
        <div>
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', color: '#a0a0a0' }}>
            Rest your troops to earn bonus turns when you return
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              className="resource-btn"
              onClick={() => onEncamp(16)}
              disabled={encampLoading}
              style={{ flex: '1 1 auto' }}
              title={`Encamp for 16 hours to receive +${TURN_MECHANICS.ENCAMP_BONUSES.ENCAMP_16_HOURS.bonusTurns} bonus turns`}
            >
              {encampLoading ? 'Encamping...' : `Encamp 16h (+${TURN_MECHANICS.ENCAMP_BONUSES.ENCAMP_16_HOURS.bonusTurns} turns)`}
            </button>
            <button
              className="resource-btn"
              onClick={() => onEncamp(24)}
              disabled={encampLoading}
              style={{ flex: '1 1 auto' }}
              title={`Encamp for 24 hours to receive +${TURN_MECHANICS.ENCAMP_BONUSES.ENCAMP_24_HOURS.bonusTurns} bonus turns`}
            >
              {encampLoading ? 'Encamping...' : `Encamp 24h (+${TURN_MECHANICS.ENCAMP_BONUSES.ENCAMP_24_HOURS.bonusTurns} turns)`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
});
