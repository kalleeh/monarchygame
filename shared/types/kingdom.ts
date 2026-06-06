/**
 * Shared type definitions for Kingdom game entities.
 * Used by both Lambda handlers and frontend code.
 *
 * Pure data interfaces live in ./kingdom-resources (enum-free, frontend-safe) and
 * are re-exported here so existing backend imports from './kingdom' keep working.
 */

export type {
  KingdomResources,
  KingdomBuildings,
  KingdomUnits,
  CombatResultData,
} from './kingdom-resources';

export enum ErrorCode {
  MISSING_PARAMS = 'MISSING_PARAMS',
  INVALID_PARAM = 'INVALID_PARAM',
  NOT_FOUND = 'NOT_FOUND',
  INSUFFICIENT_RESOURCES = 'INSUFFICIENT_RESOURCES',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  WAR_REQUIRED = 'WAR_REQUIRED',
  SEASON_INACTIVE = 'SEASON_INACTIVE',
  RESTORATION_BLOCKED = 'RESTORATION_BLOCKED',
  TRADE_EXPIRED = 'TRADE_EXPIRED',
  TREATY_CONFLICT = 'TREATY_CONFLICT',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  RATE_LIMITED = 'RATE_LIMITED',
  CONFLICT = 'CONFLICT',
}
