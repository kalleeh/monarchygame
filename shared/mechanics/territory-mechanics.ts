/**
 * Territory mechanics constants and helpers.
 * Shared between the frontend (upgrade UI/store) and backend (territory-claimer).
 */

/**
 * Maximum defense (fortification) level a territory can be upgraded to.
 * Enforced server-side in territory-claimer and client-side in the territory store
 * and upgrade UI. Legacy territories may exceed this from before the cap existed;
 * the upgrade flow must refuse rather than send an out-of-range value.
 */
export const MAX_TERRITORY_DEFENSE_LEVEL = 10;
