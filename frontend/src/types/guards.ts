/**
 * Type Guard Utilities
 * IQC Compliant: Type-safe narrowing for optional properties
 */

import type { Kingdom } from './kingdom';

/**
 * Type guard to check if Kingdom has stats property
 */
export function hasStats(kingdom: Kingdom | null | undefined): kingdom is Kingdom & { stats: NonNullable<Kingdom['stats']> } {
  return kingdom != null && kingdom.stats != null;
}

/**
 * Type guard to check if Kingdom has territories property
 */
export function hasTerritories(kingdom: Kingdom | null | undefined): kingdom is Kingdom & { territories: NonNullable<Kingdom['territories']> } {
  return kingdom != null && kingdom.territories != null && kingdom.territories.length > 0;
}

/**
 * Type guard to check if Kingdom has owner property
 */
export function hasOwner(kingdom: Kingdom | null | undefined): kingdom is Kingdom & { owner: string } {
  return kingdom != null && typeof kingdom.owner === 'string';
}

/**
 * Type guard to check if Kingdom has guildId property
 */
export function hasGuildId(kingdom: Kingdom | null | undefined): kingdom is Kingdom & { guildId: string } {
  return kingdom != null && typeof kingdom.guildId === 'string';
}
