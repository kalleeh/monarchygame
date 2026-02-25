/**
 * Kingdom Type Definitions
 * IQC Compliant: Integrity (proper types), Quality (clear interfaces), Consistency (naming)
 */

export interface Kingdom {
  id: string;
  name: string;
  race: string;
  owner?: string;
  resources: {
    gold: number;
    population: number;
    land: number;
    turns: number;
  };
  stats: {
    warOffense: number;
    warDefense: number;
    sorcery: number;
    scum: number;
    forts: number;
    tithe: number;
    training: number;
    siege: number;
    economy: number;
    building: number;
    // Set by season-lifecycle Lambda when a season ends
    previousSeasonRank?: number;
    previousSeasonNetworth?: number;
    previousSeasonNumber?: number;
  };
  territories?: Territory[];
  totalUnits: {
    peasants: number;
    militia: number;
    knights: number;
    cavalry: number;
  };
  isOnline?: boolean;
  lastActive?: Date;
  guildId?: string;
  guildName?: string;
}

export interface Territory {
  id: string;
  name: string;
  coordinates: { x: number; y: number };
  kingdomId: string;
  kingdomName: string;
  fortificationLevel: number;
  buildings: Record<string, number>;
  units: {
    peasants: number;
    militia: number;
    knights: number;
    cavalry: number;
  };
  isCapital: boolean;
}
