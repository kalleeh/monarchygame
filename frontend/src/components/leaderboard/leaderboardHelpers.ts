import type { Kingdom } from '../../types/kingdom';

export interface TargetIndicator {
  indicator: 'easy' | 'fair' | 'hard';
  turnCostModifier: number;
  color: string;
  emoji: string;
}

// Simple networth calculation (land + gold + units value)
export const calculateNetworth = (kingdom: Kingdom): number => {
  const landValue = kingdom.resources.land * 1000;
  const goldValue = kingdom.resources.gold;
  const unitsValue = Object.values(kingdom.totalUnits).reduce((sum, count) => sum + count * 100, 0);
  return landValue + goldValue + unitsValue;
};

export const getTargetIndicator = (yourNW: number, theirNW: number): TargetIndicator => {
  const ratio = theirNW / yourNW;
  if (ratio < 0.5)                   return { indicator: 'easy', turnCostModifier: 1.5, color: 'text-yellow-400', emoji: '🟡' };
  if (ratio >= 0.5 && ratio <= 1.5) return { indicator: 'fair', turnCostModifier: 1.0, color: 'text-green-400', emoji: '🟢' };
  return { indicator: 'hard', turnCostModifier: 2.0, color: 'text-red-400', emoji: '🔴' };
};

export interface GuildRow {
  guildId: string;
  label: string;
  members: number;
  totalNW: number;
  races: Set<string>;
  hasMage: boolean;
  hasWarrior: boolean;
  hasScum: boolean;
  hasFullComposition: boolean;
  coordMultiplier: number;
  sortKey: number;
}

export function computeGuildRows(
  allKingdoms: Kingdom[],
  guildNamesMap: Record<string, string>,
  activeWarCount: number,
  currentGuildId: string | undefined,
): GuildRow[] {
  const map = new Map<string, {
    guildId: string;
    label: string;
    members: number;
    totalNW: number;
    races: Set<string>;
  }>();

  for (const k of allKingdoms) {
    if (!k.guildId) continue;
    const nw = calculateNetworth(k);
    if (map.has(k.guildId)) {
      const entry = map.get(k.guildId)!;
      entry.members += 1;
      entry.totalNW += nw;
      if (k.race) entry.races.add(k.race.toLowerCase());
    } else {
      // Prefer: guildName on kingdom > guildNamesMap lookup > truncated-ID fallback
      const resolvedName =
        (k as Kingdom & { guildName?: string }).guildName ||
        guildNamesMap[k.guildId] ||
        `Guild ${k.guildId.slice(0, 8)}`;
      const races = new Set<string>();
      if (k.race) races.add(k.race.toLowerCase());
      map.set(k.guildId, {
        guildId: k.guildId,
        label: resolvedName,
        members: 1,
        totalNW: nw,
        races,
      });
    }
  }

  const mageRaces = new Set(['sidhe', 'elven', 'vampire', 'elemental', 'fae']);
  const warriorRaces = new Set(['droben', 'goblin', 'dwarven', 'centaur', 'human']);
  const scumRaces = new Set(['centaur', 'human', 'vampire', 'sidhe', 'goblin']);

  const rows = Array.from(map.values()).map(row => {
    const hasMage = [...row.races].some(r => mageRaces.has(r));
    const hasWarrior = [...row.races].some(r => warriorRaces.has(r));
    const hasScum = [...row.races].some(r => scumRaces.has(r));
    const compositionScore = (hasMage ? 1 : 0) + (hasWarrior ? 1 : 0) + (hasScum ? 1 : 0);
    const hasFullComposition = compositionScore >= 3;

    // Coordination multiplier: active war involvement boosts by 1.2x
    const isCurrentPlayerGuild = row.guildId === currentGuildId;
    const coordMultiplier = (hasFullComposition || (isCurrentPlayerGuild && activeWarCount > 0)) ? 1.2 : 1.0;

    // Sort key: totalNW * composition multiplier
    const sortKey = row.totalNW * coordMultiplier;

    return {
      ...row,
      hasMage,
      hasWarrior,
      hasScum,
      hasFullComposition,
      coordMultiplier,
      sortKey,
    };
  });

  return rows.sort((a, b) => b.sortKey - a.sortKey);
}
