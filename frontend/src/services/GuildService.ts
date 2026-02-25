/**
 * Guild Service - Real-time guild management
 * Handles guild operations, invitations, and messaging
 */

import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import { isDemoMode } from '../utils/authMode';
import { AmplifyFunctionService } from './amplifyFunctionService';

const client = generateClient<Schema>();

export interface GuildData {
  id: string;
  name: string;
  description?: string;
  tag: string;
  leaderId: string;
  leaderName: string;
  isPublic: boolean;
  maxMembers: number;
  memberCount: number;
  totalPower: number;
  createdAt: string;
  charter?: GuildCharter;
  ranking?: number;
  warDeclarations?: GuildWar[];
}

export interface GuildCharter {
  purpose: string;
  requirements: string;
  rules: string;
  autoApprove: boolean;
  password?: string;
}

export interface GuildPrivs {
  canInvite: boolean;
  canKick: boolean;
  canEditCharter: boolean;
  canDeclareWar: boolean;
  canManageRanks: boolean;
  canAcceptApplications: boolean;
}

export interface GuildApplication {
  id: string;
  guildId: string;
  kingdomId: string;
  kingdomName: string;
  race: string;
  networth: number;
  message: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

export interface GuildWarContribution {
  kingdomId: string;
  kingdomName: string;
  guildId: string;
  score: number;
  attackCount: number;
}

export interface GuildWar {
  id: string;
  attackingGuildId: string;
  defendingGuildId: string;
  attackingGuildName: string;
  defendingGuildName: string;
  status: 'ACTIVE' | 'ENDED';
  declaredAt: string;
  endsAt: string;
  attackingScore: number;
  defendingScore: number;
  contributions: GuildWarContribution[];
  winnerId?: string;
  /** @deprecated Use status === 'ACTIVE' instead */
  isActive: boolean;
}

// ---------------------------------------------------------------------------
// Guild War storage key helpers
// NOTE: There is no GuildWar model in the Amplify schema. Guild wars are
// stored in localStorage as a prototype/demo fallback. In a production
// environment these should be persisted to a dedicated backend model.
// ---------------------------------------------------------------------------
const GUILD_WARS_STORAGE_KEY = 'monarchygame_guild_wars';

function loadAllGuildWars(): GuildWar[] {
  try {
    const raw = localStorage.getItem(GUILD_WARS_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as GuildWar[];
  } catch {
    return [];
  }
}

function saveAllGuildWars(wars: GuildWar[]): void {
  localStorage.setItem(GUILD_WARS_STORAGE_KEY, JSON.stringify(wars));
}

export interface GuildInvitation {
  id: string;
  guildId: string;
  targetKingdomId: string;
  targetKingdomName: string;
  invitedBy: string;
  inviterName: string;
  status: 'pending' | 'accepted' | 'declined' | 'EXPIRED';
  message?: string;
  expiresAt?: string;
  createdAt: string;
}

export interface GuildMessage {
  id: string;
  guildId: string;
  senderId: string;
  senderName: string;
  content: string;
  messageType: 'CHAT' | 'ANNOUNCEMENT' | 'SYSTEM';
  createdAt: string;
}

// Demo mode mock data
const DEMO_GUILDS: GuildData[] = [
  {
    id: 'demo-guild-1',
    name: 'The Iron Throne',
    description: 'A powerful guild of strategic kingdoms',
    tag: 'IRON',
    leaderId: 'demo-player-1',
    leaderName: 'King Arthur',
    isPublic: true,
    maxMembers: 50,
    memberCount: 23,
    totalPower: 45000,
    createdAt: new Date().toISOString()
  },
  {
    id: 'demo-guild-2',
    name: 'Shadow Realm',
    description: 'Masters of stealth and strategy',
    tag: 'SHDW',
    leaderId: 'demo-player-2',
    leaderName: 'Dark Lord',
    isPublic: false,
    maxMembers: 30,
    memberCount: 15,
    totalPower: 32000,
    createdAt: new Date().toISOString()
  }
];

const DEMO_MESSAGES: GuildMessage[] = [
  {
    id: 'demo-msg-1',
    guildId: 'demo-guild-1',
    senderId: 'demo-player-1',
    senderName: 'King Arthur',
    content: 'Welcome to our guild! Let\'s coordinate our next attack.',
    messageType: 'CHAT',
    createdAt: new Date(Date.now() - 3600000).toISOString()
  },
  {
    id: 'demo-msg-2',
    guildId: 'demo-guild-1',
    senderId: 'demo-player-3',
    senderName: 'Knight Lancelot',
    content: 'Ready for battle, my lord!',
    messageType: 'CHAT',
    createdAt: new Date(Date.now() - 1800000).toISOString()
  }
];

export class GuildService {
  /**
   * Create a new alliance
   */
  static async createGuild(data: {
    name: string;
    description?: string;
    tag: string;
    isPublic?: boolean;
    maxMembers?: number;
    kingdomId?: string;
  }): Promise<GuildData> {
    if (isDemoMode()) {
      // Demo mode: simulate alliance creation
      const newAlliance: GuildData = {
        id: `demo-guild-${Date.now()}`,
        name: data.name,
        description: data.description,
        tag: data.tag.toUpperCase(),
        leaderId: 'demo-player',
        leaderName: 'Demo Player',
        isPublic: data.isPublic ?? true,
        maxMembers: data.maxMembers ?? 20,
        memberCount: 1,
        totalPower: 1000,
        createdAt: new Date().toISOString()
      };

      // Simulate delay
      await new Promise(resolve => setTimeout(resolve, 500));
      return newAlliance;
    }

    try {
      const result = await AmplifyFunctionService.callFunction('alliance-manager', {
        kingdomId: data.kingdomId || '',
        action: 'create',
        name: data.name,
        description: data.description,
        isPublic: data.isPublic ?? true,
      });
      const parsed = JSON.parse((result as Record<string, string>).result || '{}');
      return {
        id: parsed.allianceId || `alliance-${Date.now()}`,
        name: data.name,
        description: data.description,
        tag: data.tag.toUpperCase(),
        leaderId: data.kingdomId || '',
        leaderName: '',
        isPublic: data.isPublic ?? true,
        maxMembers: data.maxMembers ?? 20,
        memberCount: 1,
        totalPower: 0,
        createdAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error creating alliance:', error);
      throw error;
    }
  }

  /**
   * Get all public alliances
   */
  static async getPublicGuilds(): Promise<GuildData[]> {
    if (isDemoMode()) {
      // Demo mode: return mock data
      await new Promise(resolve => setTimeout(resolve, 300));
      return DEMO_GUILDS.filter(a => a.isPublic);
    }

    try {
      const response = await client.models.Alliance.list({
        filter: { isPublic: { eq: true } }
      });

      if (response.errors) {
        throw new Error(`Failed to fetch alliances: ${response.errors[0].message}`);
      }

      return response.data as unknown as GuildData[];
    } catch (error) {
      console.error('Error fetching alliances:', error);
      throw error;
    }
  }

  /**
   * Join an alliance
   */
  static async joinGuild(guildId: string, kingdomId: string): Promise<void> {
    if (isDemoMode()) {
      // Demo mode: simulate joining
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log('Demo mode: Joined alliance', guildId);
      return;
    }

    try {
      await AmplifyFunctionService.callFunction('alliance-manager', {
        kingdomId,
        action: 'join',
        allianceId: guildId,
      });
    } catch (error) {
      console.error('Error joining alliance:', error);
      throw error;
    }
  }

  /**
   * Leave an alliance
   */
  static async leaveGuild(kingdomId: string, allianceId?: string): Promise<void> {
    if (isDemoMode()) {
      // Demo mode: simulate leaving
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log('Demo mode: Left alliance');
      return;
    }

    try {
      await AmplifyFunctionService.callFunction('alliance-manager', {
        kingdomId,
        action: 'leave',
        allianceId,
      });
    } catch (error) {
      console.error('Error leaving alliance:', error);
      throw error;
    }
  }

  /**
   * Kick a member from the alliance
   */
  static async kickMember(kingdomId: string, allianceId: string, targetKingdomId: string): Promise<void> {
    if (isDemoMode()) {
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log('Demo mode: Kicked member', targetKingdomId);
      return;
    }

    try {
      await AmplifyFunctionService.callFunction('alliance-manager', {
        kingdomId,
        action: 'kick',
        allianceId,
        targetKingdomId,
      });
    } catch (error) {
      console.error('Error kicking alliance member:', error);
      throw error;
    }
  }

  /**
   * Send alliance invitation
   */
  static async sendInvitation(data: {
    guildId: string;
    targetKingdomId: string;
    targetKingdomName: string;
    kingdomId?: string;
    message?: string;
  }): Promise<GuildInvitation> {
    if (isDemoMode()) {
      // Demo mode: simulate invitation
      const invitation: GuildInvitation = {
        id: `demo-invite-${Date.now()}`,
        guildId: data.guildId,
        targetKingdomId: data.targetKingdomId,
        targetKingdomName: data.targetKingdomName,
        invitedBy: 'demo-player',
        inviterName: 'Demo Player',
        status: 'pending',
        message: data.message,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString()
      };

      await new Promise(resolve => setTimeout(resolve, 500));
      return invitation;
    }

    try {
      await AmplifyFunctionService.callFunction('alliance-manager', {
        kingdomId: data.kingdomId || '',
        action: 'invite',
        allianceId: data.guildId,
        targetKingdomId: data.targetKingdomId,
      });

      return {
        id: `invite-${Date.now()}`,
        guildId: data.guildId,
        targetKingdomId: data.targetKingdomId,
        targetKingdomName: data.targetKingdomName,
        invitedBy: data.kingdomId || '',
        inviterName: '',
        status: 'pending',
        message: data.message,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error sending invitation:', error);
      throw error;
    }
  }

  /**
   * Respond to alliance invitation
   */
  static async respondToInvitation(
    invitationId: string,
    response: 'accepted' | 'declined'
  ): Promise<void> {
    if (isDemoMode()) {
      // Demo mode: simulate responding to invitation
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log(`Demo mode: Invitation ${invitationId} ${response}`);
      return;
    }

    try {
      const updateResponse = await (client.models as unknown as Record<string, { update: (data: unknown) => Promise<{ errors?: { message: string }[] }> }>).GuildInvitation.update({
        id: invitationId,
        status: response,
      });

      if (updateResponse.errors) {
        throw new Error(`Failed to respond to invitation: ${updateResponse.errors[0].message}`);
      }

      // If accepted, join the alliance
      if (response === 'accepted') {
        // Additional logic to join guild would go here
      }
    } catch (error) {
      console.error('Error responding to invitation:', error);
      throw error;
    }
  }

  /**
   * Send alliance message
   */
  static async sendGuildMessage(data: {
    guildId: string;
    content: string;
    senderId?: string;
    senderName?: string;
    messageType?: 'CHAT' | 'ANNOUNCEMENT' | 'SYSTEM';
  }): Promise<GuildMessage> {
    if (isDemoMode()) {
      // Demo mode: simulate message sending
      const message: GuildMessage = {
        id: `demo-msg-${Date.now()}`,
        guildId: data.guildId,
        senderId: data.senderId ?? 'demo-player',
        senderName: data.senderName ?? 'Demo Player',
        content: data.content,
        messageType: data.messageType ?? 'CHAT',
        createdAt: new Date().toISOString()
      };

      await new Promise(resolve => setTimeout(resolve, 300));
      return message;
    }

    // Auth mode: persist to AllianceMessage in AppSync
    try {
      const typeMap: Record<string, 'general' | 'announcement' | 'war' | 'diplomacy'> = {
        CHAT: 'general',
        ANNOUNCEMENT: 'announcement',
        SYSTEM: 'general',
      };
      const appSyncType = typeMap[data.messageType ?? 'CHAT'] ?? 'general';

      const response = await client.models.AllianceMessage.create({
        guildId: data.guildId,
        senderId: data.senderId ?? 'unknown',
        content: data.content,
        type: appSyncType,
        createdAt: new Date().toISOString(),
      });

      if (response.errors) {
        throw new Error(`Failed to send message: ${response.errors[0].message}`);
      }

      const item = response.data;
      return {
        id: item?.id ?? `msg-${Date.now()}`,
        guildId: item?.guildId ?? data.guildId,
        senderId: item?.senderId ?? data.senderId ?? 'unknown',
        senderName: data.senderName ?? item?.senderId ?? 'Unknown',
        content: item?.content ?? data.content,
        messageType: data.messageType ?? 'CHAT',
        createdAt: item?.createdAt ?? new Date().toISOString(),
      };
    } catch (error) {
      console.error('[GuildService] Error sending alliance message:', error);
      throw error;
    }
  }

  /**
   * Get alliance messages
   */
  static async getGuildMessages(guildId: string): Promise<GuildMessage[]> {
    if (isDemoMode()) {
      // Demo mode: return mock messages
      await new Promise(resolve => setTimeout(resolve, 300));
      return DEMO_MESSAGES.filter(m => m.guildId === guildId);
    }

    // Auth mode: fetch from AllianceMessage in AppSync
    try {
      const response = await client.models.AllianceMessage.list({
        filter: { guildId: { eq: guildId } }
      });

      if (response.errors) {
        throw new Error(`Failed to fetch messages: ${response.errors[0].message}`);
      }

      return (response.data ?? []).map(item => ({
        id: item.id,
        guildId: item.guildId,
        senderId: item.senderId,
        senderName: item.senderId, // AllianceMessage has no senderName; use senderId as fallback
        content: item.content,
        messageType: 'CHAT' as const,
        createdAt: item.createdAt ?? new Date().toISOString(),
      }));
    } catch (error) {
      console.error('[GuildService] Error fetching alliance messages:', error);
      throw error;
    }
  }

  /**
   * Subscribe to alliance messages for real-time updates
   */
  static subscribeToGuildMessages(
    guildId: string,
    onMessage: (message: GuildMessage) => void
  ) {
    if (isDemoMode()) {
      // Demo mode: return mock subscription
      return {
        unsubscribe: () => console.log('Demo mode: Unsubscribed from messages')
      };
    }

    // Auth mode: subscribe via AllianceMessage.onCreate
    const sub = client.models.AllianceMessage.onCreate({
      filter: { guildId: { eq: guildId } }
    }).subscribe({
      next: (item) => {
        if (item) {
          onMessage({
            id: item.id,
            guildId: item.guildId,
            senderId: item.senderId,
            senderName: item.senderId,
            content: item.content,
            messageType: 'CHAT',
            createdAt: item.createdAt ?? new Date().toISOString(),
          });
        }
      },
      error: (error: unknown) => {
        console.error('[GuildService] Alliance message subscription error:', error);
      }
    });

    return sub;
  }

  // =========================================================================
  // Guild War operations
  // NOTE: Stored in localStorage (no GuildWar Amplify model). In a
  // production build this should be backed by a dedicated backend model.
  // =========================================================================

  /**
   * Declare a guild war.
   * Input: attackingGuildId, defendingGuildId, declaringKingdomId,
   *        attackingGuildName, defendingGuildName
   */
  static async declareGuildWar(data: {
    attackingGuildId: string;
    defendingGuildId: string;
    declaringKingdomId: string;
    attackingGuildName: string;
    defendingGuildName: string;
  }): Promise<GuildWar> {
    const { attackingGuildId, defendingGuildId, attackingGuildName, defendingGuildName } = data;

    if (attackingGuildId === defendingGuildId) {
      throw new Error('Cannot declare war on your own guild');
    }

    const existing = loadAllGuildWars();

    // Check if already in active guild war between these two guilds
    const alreadyAtWar = existing.some(
      w =>
        w.status === 'ACTIVE' &&
        ((w.attackingGuildId === attackingGuildId && w.defendingGuildId === defendingGuildId) ||
          (w.attackingGuildId === defendingGuildId && w.defendingGuildId === attackingGuildId))
    );
    if (alreadyAtWar) {
      throw new Error('Already in an active war between these guilds');
    }

    const now = new Date();
    const endsAt = new Date(now.getTime() + 72 * 60 * 60 * 1000); // 72 hours

    const war: GuildWar = {
      id: `guildwar-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      attackingGuildId,
      defendingGuildId,
      attackingGuildName,
      defendingGuildName,
      status: 'ACTIVE',
      declaredAt: now.toISOString(),
      endsAt: endsAt.toISOString(),
      attackingScore: 0,
      defendingScore: 0,
      contributions: [],
      isActive: true,
    };

    saveAllGuildWars([...existing, war]);
    return war;
  }

  /**
   * Resolve a guild war — set status to ENDED, determine winner.
   */
  static async resolveGuildWar(warId: string): Promise<GuildWar> {
    const wars = loadAllGuildWars();
    const idx = wars.findIndex(w => w.id === warId);
    if (idx === -1) throw new Error('Guild war not found');

    const war = wars[idx];
    let winnerId: string | undefined;
    if (war.attackingScore > war.defendingScore) {
      winnerId = war.attackingGuildId;
    } else if (war.defendingScore > war.attackingScore) {
      winnerId = war.defendingGuildId;
    }
    // tie → no winner (winnerId stays undefined)

    const updated: GuildWar = { ...war, status: 'ENDED', isActive: false, winnerId };
    wars[idx] = updated;
    saveAllGuildWars(wars);
    return updated;
  }

  /**
   * Record a guild war contribution after a successful attack.
   * Adds points to the appropriate guild's score and upserts the
   * contributor record. Does NOT throw — safe for fire-and-forget use.
   */
  static recordGuildWarContribution(params: {
    warId: string;
    kingdomId: string;
    kingdomName: string;
    guildId: string;
    points: number;
  }): void {
    try {
      const { warId, kingdomId, kingdomName, guildId, points } = params;
      if (points <= 0) return;

      const wars = loadAllGuildWars();
      const idx = wars.findIndex(w => w.id === warId);
      if (idx === -1) return;

      const war = { ...wars[idx] };
      if (war.status !== 'ACTIVE') return;

      // Add to score
      if (guildId === war.attackingGuildId) {
        war.attackingScore = (war.attackingScore || 0) + points;
      } else if (guildId === war.defendingGuildId) {
        war.defendingScore = (war.defendingScore || 0) + points;
      } else {
        return; // kingdom not in this war
      }

      // Upsert contributor
      const contributions = [...(war.contributions || [])];
      const contribIdx = contributions.findIndex(
        c => c.kingdomId === kingdomId && c.guildId === guildId
      );
      if (contribIdx === -1) {
        contributions.push({ kingdomId, kingdomName, guildId, score: points, attackCount: 1 });
      } else {
        contributions[contribIdx] = {
          ...contributions[contribIdx],
          score: contributions[contribIdx].score + points,
          attackCount: contributions[contribIdx].attackCount + 1,
        };
      }
      war.contributions = contributions;

      wars[idx] = war;
      saveAllGuildWars(wars);
    } catch (e) {
      // Fire-and-forget: never let this crash the caller
      console.warn('[GuildService] recordGuildWarContribution failed silently:', e);
    }
  }

  /**
   * Concede an active guild war (sets status to ENDED with the other guild as winner).
   * Only callable by the conceding guild.
   */
  static async concedeGuildWar(warId: string, concedingGuildId: string): Promise<GuildWar> {
    const wars = loadAllGuildWars();
    const idx = wars.findIndex(w => w.id === warId);
    if (idx === -1) throw new Error('Guild war not found');

    const war = wars[idx];
    if (war.status !== 'ACTIVE') throw new Error('War is not active');

    const winnerId =
      concedingGuildId === war.attackingGuildId
        ? war.defendingGuildId
        : war.attackingGuildId;

    const updated: GuildWar = { ...war, status: 'ENDED', isActive: false, winnerId };
    wars[idx] = updated;
    saveAllGuildWars(wars);
    return updated;
  }

  /**
   * Load guild wars for a given guild (active + recent ended).
   * Returns wars sorted newest first.
   */
  static async loadGuildWars(guildId: string): Promise<{ active: GuildWar[]; history: GuildWar[] }> {
    // Simulate async I/O
    await new Promise(resolve => setTimeout(resolve, 0));

    // Auto-expire any wars past their endsAt timestamp
    const now = new Date();
    let wars = loadAllGuildWars();
    let dirty = false;
    wars = wars.map(w => {
      if (w.status === 'ACTIVE' && new Date(w.endsAt) < now) {
        dirty = true;
        let winnerId: string | undefined;
        if (w.attackingScore > w.defendingScore) winnerId = w.attackingGuildId;
        else if (w.defendingScore > w.attackingScore) winnerId = w.defendingGuildId;
        return { ...w, status: 'ENDED' as const, isActive: false, winnerId };
      }
      return w;
    });
    if (dirty) saveAllGuildWars(wars);

    const relevant = wars.filter(
      w => w.attackingGuildId === guildId || w.defendingGuildId === guildId
    );

    const active = relevant
      .filter(w => w.status === 'ACTIVE')
      .sort((a, b) => new Date(b.declaredAt).getTime() - new Date(a.declaredAt).getTime());

    const history = relevant
      .filter(w => w.status === 'ENDED')
      .sort((a, b) => new Date(b.declaredAt).getTime() - new Date(a.declaredAt).getTime())
      .slice(0, 10); // Keep last 10

    return { active, history };
  }

  /**
   * Find an active guild war where both guildA and guildB are participants.
   * Returns null if none found. Used by the combat hook for war scoring.
   */
  static findActiveWarBetween(guildIdA: string, guildIdB: string): GuildWar | null {
    const wars = loadAllGuildWars();
    return (
      wars.find(
        w =>
          w.status === 'ACTIVE' &&
          ((w.attackingGuildId === guildIdA && w.defendingGuildId === guildIdB) ||
            (w.attackingGuildId === guildIdB && w.defendingGuildId === guildIdA))
      ) ?? null
    );
  }

  /**
   * Subscribe to alliance invitations
   */
  static subscribeToInvitations(
    kingdomId: string,
    onInvitation: (invitation: GuildInvitation) => void
  ) {
    if (isDemoMode()) {
      // Demo mode: return mock subscription
      return {
        unsubscribe: () => console.log('Demo mode: Unsubscribed from invitations')
      };
    }

    return (client.models as unknown as Record<string, { onCreate: (options: unknown) => { subscribe: (handlers: { next: (data: unknown) => void; error: (error: unknown) => void }) => { unsubscribe: () => void } } }>).GuildInvitation.onCreate({
      filter: { inviteeId: { eq: kingdomId } }
    }).subscribe({
      next: (data: unknown) => {
        if (data) {
          onInvitation(data as unknown as GuildInvitation);
        }
      },
      error: (error: unknown) => {
        console.error('Alliance invitation subscription error:', error);
      }
    });
  }
}
