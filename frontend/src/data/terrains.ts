import { TerrainType, type TerrainEffect } from '../types/combat';

export const TERRAINS: TerrainEffect[] = [
  {
    type: TerrainType.PLAINS,
    name: 'Plains',
    description: 'Open terrain with no tactical advantages',
    icon: '🌾',
    modifiers: {},
  },
  {
    type: TerrainType.FOREST,
    name: 'Forest',
    description: 'Dense woods provide defensive cover but hinder cavalry',
    icon: '🌲',
    modifiers: {
      defense: 0.2, // +20% defense
      cavalry: -0.1, // -10% cavalry effectiveness
    },
  },
  {
    type: TerrainType.MOUNTAINS,
    name: 'Mountains',
    description: 'High ground provides strong defense but limits siege weapons',
    icon: '⛰️',
    modifiers: {
      defense: 0.3, // +30% defense
      siege: -0.2, // -20% siege effectiveness
    },
  },
  {
    type: TerrainType.SWAMP,
    name: 'Swamp',
    description: 'Treacherous marshland hinders all unit movement',
    icon: '🌿',
    modifiers: {
      defense: -0.15, // -15% defense
      offense: -0.15, // -15% offense
      cavalry: -0.15, // -15% cavalry
      infantry: -0.15, // -15% infantry
    },
  },
  {
    type: TerrainType.DESERT,
    name: 'Desert',
    description: 'Open sands favor cavalry but exhaust infantry',
    icon: '🏜️',
    modifiers: {
      cavalry: 0.15, // +15% cavalry
      infantry: -0.1, // -10% infantry
    },
  },
];
