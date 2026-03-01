/**
 * Domain service for spell casting calls.
 * Delegates to AmplifyFunctionService for transport.
 *
 * Note: The higher-level SpellService at services/SpellService.ts provides
 * richer typed methods (getAvailableSpells, validateSpell, etc.) and already
 * uses AmplifyFunctionService. This thin module exposes the low-level calls
 * for callers that only need the raw transport layer.
 *
 * Prefer importing from services/SpellService.ts for application code.
 */

export {
  SpellService,
  type SpellData,
  type SpellCastResponse,
  type SpellValidationResponse,
} from '../SpellService';
