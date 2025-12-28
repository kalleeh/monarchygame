/**
 * Diplomacy System Types
 * Type definitions for diplomatic relations and treaties
 */

export type DiplomaticStatus = 'NEUTRAL' | 'FRIENDLY' | 'ALLIED' | 'HOSTILE' | 'WAR';
export type TreatyType = 'NON_AGGRESSION' | 'TRADE_AGREEMENT' | 'MILITARY_ALLIANCE';
export type TreatyStatus = 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'BROKEN';
export type DiplomaticActionType = 'PROPOSAL_SENT' | 'PROPOSAL_ACCEPTED' | 'PROPOSAL_REJECTED' | 'WAR_DECLARED' | 'PEACE_MADE';

export interface Kingdom {
  id: string;
  name: string;
  race: string;
  power?: number;
  reputation?: number;
}

export interface Treaty {
  id: string;
  type: TreatyType;
  terms: Record<string, string | number | boolean>;
  status: TreatyStatus;
  createdAt: Date;
  expiresAt?: Date;
}

export interface DiplomaticRelationship {
  id: string;
  fromKingdom: Kingdom;
  toKingdom: Kingdom;
  status: DiplomaticStatus;
  treaties: Treaty[];
  reputation: number;
  lastAction: Date;
}

export interface TreatyProposal {
  id: string;
  fromKingdom: Kingdom;
  toKingdom: Kingdom;
  treatyType: TreatyType;
  terms: Record<string, string | number | boolean>;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  createdAt: Date;
}

export interface DiplomaticAction {
  id: string;
  type: DiplomaticActionType;
  fromKingdom: Kingdom;
  toKingdom: Kingdom;
  details: string;
  timestamp: Date;
}
