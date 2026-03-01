import React from 'react';
import { AchievementWidget } from '../achievements/AchievementWidget';

interface AchievementsPanelProps {
  kingdomId: string;
}

export function AchievementsPanel({ kingdomId }: AchievementsPanelProps) {
  return (
    <div style={{ gridColumn: '1 / -1' }}>
      <AchievementWidget kingdomId={kingdomId} />
    </div>
  );
}
